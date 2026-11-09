"use client";

import { useActionState, useMemo, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { precioPropuesto, simularFifo, type OrigenPrecio } from "@/dominio/ventas";
import { formatearDolares, formatearPesos, parsearImporte } from "@/lib/dinero";
import { nuevoUuid } from "@/lib/uuid";
import type { DatosNuevaVenta } from "@/datos/ventas";
import { registrarVenta } from "../acciones";

type Item = { productoId: string; cantidad: number; precio: string; origen: OrigenPrecio };

const TEXTO_ORIGEN: Record<OrigenPrecio, string> = {
  especial: "precio especial del cliente",
  ultimo: "último precio que pagó",
  general: "precio general",
  ninguno: "sin precio cargado",
};

function normalizar(t: string) {
  return t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
function centavosATexto(c: number) {
  return formatearPesos(c).replace("$ ", "");
}

export function FormularioVenta({
  datos,
  clienteInicial,
  socioActual,
  hoy,
}: {
  datos: DatosNuevaVenta;
  clienteInicial: string;
  socioActual: string;
  hoy: string;
}) {
  const [estado, enviar, enviando] = useActionState(registrarVenta, {});
  const [id] = useState(() => nuevoUuid()); // una venta = un identificador: reenviar no duplica
  const [clienteId, setClienteId] = useState(clienteInicial);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [agregando, setAgregando] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [fecha, setFecha] = useState(hoy);
  const [vendidoPor, setVendidoPor] = useState(socioActual);
  const [nota, setNota] = useState("");

  const productos = useMemo(() => new Map(datos.productos.map((p) => [p.id, p])), [datos.productos]);
  const cliente = datos.clientes.find((c) => c.id === clienteId);

  const proponer = (productoId: string, cId: string) => {
    const p = productos.get(productoId);
    return precioPropuesto({
      especial: datos.especiales[cId]?.[productoId] ?? null,
      ultimoPagado: datos.ultimos[cId]?.[productoId] ?? null,
      general: p?.precioGeneral ?? null,
    });
  };

  const elegirCliente = (cId: string) => {
    setClienteId(cId);
    setBusquedaCliente("");
    // Si ya había productos, se recalcula el precio propuesto para el nuevo cliente.
    setItems((lista) =>
      lista.map((it) => {
        const pr = proponer(it.productoId, cId);
        return { ...it, precio: pr.precio !== null ? centavosATexto(pr.precio) : "", origen: pr.origen };
      }),
    );
  };

  const agregar = (productoId: string) => {
    const pr = proponer(productoId, clienteId);
    setItems((l) => [...l, { productoId, cantidad: 1, precio: pr.precio !== null ? centavosATexto(pr.precio) : "", origen: pr.origen }]);
    setBusquedaProducto("");
    setAgregando(false);
  };
  const cambiarItem = (i: number, cambio: Partial<Item>) => setItems((l) => l.map((it, j) => (j === i ? { ...it, ...cambio } : it)));
  const quitarItem = (i: number) => setItems((l) => l.filter((_, j) => j !== i));

  // Vista previa: precio, costo FIFO estimado y ganancia (la base recalcula el costo real al guardar).
  const resumen = useMemo(() => {
    const filas = items.map((it) => {
      const p = productos.get(it.productoId)!;
      const precio = parsearImporte(it.precio);
      const fifo = simularFifo(p.compras, it.cantidad);
      return {
        precioError: precio.ok ? null : it.precio.trim() === "" ? "Poné el precio." : precio.error,
        subtotal: precio.ok ? precio.centavos * it.cantidad : null,
        faltan: fifo.faltan,
        costoArs: fifo.costoArs,
        costoUsd: fifo.costoUsd,
      };
    });
    const importe = filas.reduce((s, f) => s + (f.subtotal ?? 0), 0);
    const costo = filas.reduce((s, f) => s + f.costoArs, 0);
    const costoUsd = filas.reduce((s, f) => s + f.costoUsd, 0);
    return {
      filas,
      importe,
      costo,
      costoUsd,
      ganancia: importe - costo,
      completo: filas.every((f) => f.subtotal !== null),
      sinStock: filas.some((f) => f.faltan > 0),
    };
  }, [items, productos]);

  const clientesFiltrados = useMemo(() => {
    const q = normalizar(busquedaCliente.trim());
    return (q ? datos.clientes.filter((c) => normalizar(c.nombre).includes(q)) : datos.clientes).slice(0, 8);
  }, [busquedaCliente, datos.clientes]);

  const productosFiltrados = useMemo(() => {
    const q = normalizar(busquedaProducto.trim());
    const usados = new Set(items.map((i) => i.productoId));
    return datos.productos.filter((p) => !usados.has(p.id) && (!q || normalizar(p.nombre).includes(q)));
  }, [busquedaProducto, datos.productos, items]);

  const puedeConfirmar = cliente && items.length > 0 && resumen.completo && !resumen.sinStock && !enviando;
  const datosJson = JSON.stringify({
    id,
    clienteId,
    vendidoPor,
    fecha,
    nota,
    items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precio: i.precio })),
  });

  return (
    <form action={enviar} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="datos" value={datosJson} />

      {/* 1. Cliente */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">1. Cliente</h2>
        {cliente ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-acento bg-superficie px-4 py-3">
            <span className="text-xl font-semibold">{cliente.nombre}</span>
            <button type="button" onClick={() => setClienteId("")} className="min-h-[44px] px-2 font-medium text-acento">
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg"
            />
            <ul className="flex flex-col gap-1">
              {clientesFiltrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => elegirCliente(c.id)}
                    className="min-h-[52px] w-full rounded-xl border border-borde bg-superficie px-4 text-left text-lg"
                  >
                    {c.nombre}
                  </button>
                </li>
              ))}
              {clientesFiltrados.length === 0 && <li className="py-2 text-texto-suave">No hay clientes que coincidan.</li>}
            </ul>
          </>
        )}
      </section>

      {/* 2. Productos */}
      {cliente && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">2. Productos</h2>
          {items.map((it, i) => {
            const p = productos.get(it.productoId)!;
            const fila = resumen.filas[i];
            return (
              <article key={it.productoId} className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-semibold">{p.nombre}</span>
                  <button type="button" onClick={() => quitarItem(i)} className="min-h-[44px] px-2 text-peligro" aria-label={`Quitar ${p.nombre}`}>
                    Quitar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-texto-suave">Cantidad (hay {p.unidades})</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarItem(i, { cantidad: Math.max(1, it.cantidad - 1) })}
                        className="h-[52px] w-[52px] rounded-xl border border-borde text-2xl font-bold"
                        aria-label="Uno menos"
                      >
                        −
                      </button>
                      <input
                        inputMode="numeric"
                        value={it.cantidad}
                        onChange={(e) => {
                          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                          cambiarItem(i, { cantidad: Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1 });
                        }}
                        aria-label={`Cantidad de ${p.nombre}`}
                        className="h-[52px] w-full min-w-0 rounded-xl border border-borde bg-superficie text-center text-xl font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => cambiarItem(i, { cantidad: it.cantidad + 1 })}
                        className="h-[52px] w-[52px] rounded-xl border border-borde text-2xl font-bold"
                        aria-label="Uno más"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-texto-suave">Precio por unidad</span>
                    <input
                      inputMode="decimal"
                      value={it.precio}
                      onChange={(e) => cambiarItem(i, { precio: e.target.value, origen: it.origen })}
                      aria-label={`Precio de ${p.nombre}`}
                      className={`h-[52px] rounded-xl border bg-superficie px-3 text-xl font-bold ${fila.precioError ? "border-peligro" : "border-borde"}`}
                    />
                  </label>
                </div>
                <span className="text-sm text-texto-suave">Propuesto: {TEXTO_ORIGEN[it.origen]}</span>
                {fila.precioError && <span className="text-sm text-peligro">{fila.precioError}</span>}
                {fila.faltan > 0 && <span className="text-sm font-semibold text-peligro">No alcanza el stock: hay {p.unidades}.</span>}
                {fila.subtotal !== null && <span className="text-right text-base font-semibold">Subtotal {formatearPesos(fila.subtotal)}</span>}
              </article>
            );
          })}

          {agregando || items.length === 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-borde p-3">
              <input
                type="search"
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                placeholder="Buscar producto"
                aria-label="Buscar producto"
                className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg"
              />
              <ul className="flex flex-col gap-1">
                {productosFiltrados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => agregar(p.id)}
                      className="flex min-h-[52px] w-full items-center justify-between rounded-xl border border-borde bg-superficie px-4 text-left text-lg"
                    >
                      <span>{p.nombre}</span>
                      <span className="text-sm text-texto-suave">{p.unidades} u</span>
                    </button>
                  </li>
                ))}
                {productosFiltrados.length === 0 && (
                  <li className="py-2 text-texto-suave">
                    {datos.productos.length === 0 ? "No hay productos con stock." : "No hay más productos con stock que coincidan."}
                  </li>
                )}
              </ul>
              {items.length > 0 && (
                <button type="button" onClick={() => setAgregando(false)} className="min-h-[44px] font-medium text-acento">
                  Listo
                </button>
              )}
            </div>
          ) : (
            <Boton type="button" variante="secundario" onClick={() => setAgregando(true)}>
              + Agregar otro producto
            </Boton>
          )}
        </section>
      )}

      {/* 3. Confirmar */}
      {cliente && items.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-borde bg-superficie p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-lg">Total</span>
              <span className="text-3xl font-bold">{formatearPesos(resumen.importe)}</span>
            </div>
            <p className="mt-1 text-sm text-texto-suave">
              Costo estimado {formatearPesos(resumen.costo)} ({formatearDolares(resumen.costoUsd)}) · Ganancia estimada{" "}
              <strong className={resumen.ganancia < 0 ? "text-peligro" : ""}>{formatearPesos(resumen.ganancia)}</strong>
            </p>
          </div>

          <details className="rounded-xl border border-borde bg-superficie p-3">
            <summary className="min-h-[44px] cursor-pointer content-center font-medium">
              Más opciones (fecha, quién vendió, nota)
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-medium">Fecha</span>
                <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Vendió</span>
                <select value={vendidoPor} onChange={(e) => setVendidoPor(e.target.value)} className="min-h-[52px] rounded-xl border border-borde bg-superficie px-3 text-lg">
                  {datos.socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Nota</span>
                <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg" />
              </label>
            </div>
          </details>

          {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
          <Boton type="submit" disabled={!puedeConfirmar}>
            {enviando ? "Guardando…" : `Confirmar venta · ${formatearPesos(resumen.importe)}`}
          </Boton>
        </section>
      )}
    </form>
  );
}
