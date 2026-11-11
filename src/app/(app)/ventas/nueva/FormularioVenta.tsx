"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Icono } from "@/componentes/Iconos";
import { Avatar } from "@/componentes/UI";
import { cambiarCantidad, proponerPrecio, reproponerPrecios, resumirCarrito, TEXTO_ORIGEN, type ItemCarrito } from "@/dominio/carrito";
import { limpiarNombre, MAXIMO_NOMBRE, MAXIMO_TELEFONO, problemaClienteNuevo, textoParaCrear } from "@/dominio/clienteNuevo";
import type { DatosNuevaVenta } from "@/datos/ventas";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { formatearDia } from "@/lib/fechas";
import { coincide } from "@/lib/texto";
import { nuevoUuid } from "@/lib/uuid";
import { registrarVenta } from "../acciones";

/** Pantalla de venta (maqueta docs/maquetas, pantalla 2): todo en una sola pantalla y un solo botón. */
export function FormularioVenta({
  datos,
  clienteInicial,
  socioActual,
  hoy,
  volverA,
}: {
  datos: DatosNuevaVenta;
  clienteInicial: string;
  socioActual: string;
  hoy: string;
  volverA: string;
}) {
  const [estado, enviar, enviando] = useActionState(registrarVenta, {});
  const [id] = useState(() => nuevoUuid()); // una venta = un identificador: reenviar no duplica
  const [clienteId, setClienteId] = useState(clienteInicial);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [opciones, setOpciones] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const [vendidoPor, setVendidoPor] = useState(socioActual);
  const [nota, setNota] = useState("");
  // Cliente nuevo (se crea recién al guardar, junto con la venta). Su UUID se genera al confirmarlo.
  const [clienteNuevo, setClienteNuevo] = useState<{ id: string; nombre: string; telefono: string } | null>(null);
  const [creando, setCreando] = useState<{ nombre: string; telefono: string } | null>(null);
  // Cliente existente que no estaba en la lista al abrir la pantalla (lo creó otro socio mientras tanto).
  const [extra, setExtra] = useState<{ id: string; nombre: string } | null>(null);

  const productos = useMemo(() => new Map(datos.productos.map((p) => [p.id, p])), [datos.productos]);
  const precios = useMemo(() => ({ especiales: datos.especiales, ultimos: datos.ultimos }), [datos.especiales, datos.ultimos]);
  const cliente = datos.clientes.find((c) => c.id === clienteId) ?? (extra?.id === clienteId ? extra : undefined);
  // El cliente al que se le vende: uno existente o el nuevo (los precios se proponen con su id: el nuevo no tiene
  // precios especiales ni último precio, así que salen los generales).
  const idElegido = clienteNuevo?.id ?? clienteId;
  const hayCliente = Boolean(cliente || clienteNuevo);
  const resumen = useMemo(() => resumirCarrito(items, productos, hayCliente), [items, productos, hayCliente]);
  const conocidos = useMemo(() => [...datos.clientes, ...datos.archivados.map((c) => ({ ...c, archivado: true }))], [datos.clientes, datos.archivados]);
  const problemaNuevo = creando ? problemaClienteNuevo(creando, conocidos) : null;
  const enCarrito = new Map(items.map((i) => [i.productoId, i]));

  const elegirCliente = (cId: string) => {
    setClienteId(cId);
    setClienteNuevo(null);
    setCreando(null);
    setBusquedaCliente("");
    setItems((l) => reproponerPrecios(l, cId, productos, precios));
  };
  const confirmarClienteNuevo = () => {
    if (!creando || problemaNuevo) return;
    const nuevo = { id: nuevoUuid(), nombre: limpiarNombre(creando.nombre), telefono: creando.telefono.trim() };
    setClienteNuevo(nuevo);
    setClienteId("");
    setCreando(null);
    setBusquedaCliente("");
    setItems((l) => reproponerPrecios(l, nuevo.id, productos, precios));
  };
  const usarExistente = (c: { id: string; nombre: string }) => {
    if (!datos.clientes.some((x) => x.id === c.id)) setExtra({ id: c.id, nombre: c.nombre });
    elegirCliente(c.id);
  };
  const cambiarCliente = () => {
    setClienteId("");
    setClienteNuevo(null);
  };
  const sumar = (productoId: string, delta: number) =>
    setItems((l) => cambiarCantidad(l, productoId, delta, { clienteId: idElegido, productos, precios }));
  const cambiarPrecio = (productoId: string, precio: string) => setItems((l) => l.map((i) => (i.productoId === productoId ? { ...i, precio } : i)));

  const clientesFiltrados = datos.clientes.filter((c) => coincide(c.nombre, busquedaCliente)).slice(0, 8);
  const paraCrear = textoParaCrear(busquedaCliente);
  const productosFiltrados = datos.productos.filter((p) => coincide(p.nombre, busquedaProducto));
  const nombreSocio = datos.socios.find((s) => s.id === vendidoPor)?.nombre ?? "";
  const textoOpciones = `${fecha === hoy ? "Hoy" : formatearDia(fecha)} · vendió ${nombreSocio} · ${nota.trim() ? `nota: “${nota.trim()}”` : "sin nota"}`;
  const datosJson = JSON.stringify({
    id,
    clienteId: idElegido,
    clienteNuevo: clienteNuevo ? { nombre: clienteNuevo.nombre, telefono: clienteNuevo.telefono } : null,
    vendidoPor,
    fecha,
    nota,
    items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precio: i.precio })),
  });

  const saldo = cliente ? (datos.saldos[cliente.id] ?? 0) : 0;
  const campo = "min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3 text-texto";
  const avisoDuplicado = (existente: { id: string; nombre: string; archivado?: boolean }, mensaje: string) => (
    <div role="alert" className="aviso-aparecer flex flex-col gap-2 rounded-[14px] bg-aviso-suave px-3 py-2.5 text-[0.85rem] leading-snug">
      <span>
        <b className="text-aviso">{mensaje}</b>
        {existente.archivado && <> “{existente.nombre}” está archivado: desarchivalo desde su ficha para venderle.</>}
      </span>
      {existente.archivado ? (
        <Link href={`/clientes/${existente.id}`} className="font-semibold text-acento">
          Ver la ficha de {existente.nombre} ›
        </Link>
      ) : (
        <button type="button" onClick={() => usarExistente(existente)} className="boton-toque min-h-[44px] w-full rounded-[12px] bg-acento font-bold text-acento-texto">
          Usar a {existente.nombre}
        </button>
      )}
    </div>
  );

  const tarjetaCliente = clienteNuevo ? (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3 shadow-tarjeta">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nombre={clienteNuevo.nombre} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{clienteNuevo.nombre}</span>
          <span className="truncate text-[0.82rem] text-acento">
            Cliente nuevo{clienteNuevo.telefono ? <span className="text-texto-suave"> · {clienteNuevo.telefono}</span> : null}
          </span>
        </div>
      </div>
      <button type="button" onClick={cambiarCliente} className="min-h-[44px] px-1 text-[0.82rem] font-semibold text-acento">
        Cambiar
      </button>
    </div>
  ) : creando ? (
    <div className="flex flex-col gap-3 rounded-[20px] border border-borde bg-superficie p-4 shadow-tarjeta" aria-label="Cliente nuevo">
      <span className="text-[1.05rem] font-bold">Cliente nuevo</span>
      <label className="flex flex-col gap-1">
        <span className="text-[0.85rem] font-semibold">Nombre</span>
        <input
          value={creando.nombre}
          onChange={(e) => setCreando({ ...creando, nombre: e.target.value })}
          maxLength={MAXIMO_NOMBRE + 10}
          autoComplete="off"
          autoFocus
          aria-label="Nombre del cliente nuevo"
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[0.85rem] font-semibold">Teléfono (opcional)</span>
        <input
          value={creando.telefono}
          onChange={(e) => setCreando({ ...creando, telefono: e.target.value })}
          inputMode="tel"
          autoComplete="off"
          maxLength={MAXIMO_TELEFONO + 5}
          placeholder="Ej: 381 15 555-1234"
          aria-label="Teléfono del cliente nuevo"
          className={campo}
        />
      </label>
      <p className="text-[0.72rem] text-texto-suave">Se guarda junto con la venta. Visitas, notas y lo demás se completan después desde su ficha.</p>
      {problemaNuevo?.tipo === "duplicado"
        ? avisoDuplicado(problemaNuevo.existente, problemaNuevo.mensaje)
        : problemaNuevo && creando.nombre.trim() !== "" && <p className="text-[0.82rem] text-peligro">{problemaNuevo.mensaje}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setCreando(null)} className="boton-toque min-h-[48px] rounded-[14px] border border-borde bg-superficie font-bold">
          Cancelar
        </button>
        <button type="button" onClick={confirmarClienteNuevo} disabled={problemaNuevo !== null} className="boton-toque min-h-[48px] rounded-[14px] bg-acento font-bold text-acento-texto disabled:opacity-50">
          Listo
        </button>
      </div>
    </div>
  ) : cliente ? (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3 shadow-tarjeta">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nombre={cliente.nombre} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{cliente.nombre}</span>
          <span className={`text-[0.82rem] ${saldo > 0 ? "text-peligro" : "text-texto-suave"}`}>
            {saldo > 0 ? `Debe ${formatearPesos(saldo)}` : saldo < 0 ? `Tiene ${formatearPesos(-saldo)} a favor` : "No debe nada"}
          </span>
        </div>
      </div>
      <button type="button" onClick={cambiarCliente} className="min-h-[44px] px-1 text-[0.82rem] font-semibold text-acento">
        Cambiar
      </button>
    </div>
  ) : (
    <div className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie p-3 shadow-tarjeta">
      <label className="flex min-h-[50px] items-center gap-2.5 rounded-[14px] bg-superficie-2 px-3.5 text-texto-suave">
        <Icono nombre="buscar" />
        <input
          type="search"
          value={busquedaCliente}
          onChange={(e) => setBusquedaCliente(e.target.value)}
          placeholder="Buscar cliente"
          aria-label="Buscar cliente"
          className="min-w-0 flex-1 bg-transparent text-texto outline-none placeholder:text-texto-suave"
        />
      </label>
      <ul className="flex flex-col divide-y divide-borde">
        {/* Siempre primero, sin tener que escribir nada (pedido de los socios). Si hay algo escrito, lo usa de nombre. */}
        <li>
          <button
            type="button"
            onClick={() => setCreando({ nombre: paraCrear ?? "", telefono: "" })}
            className="flex w-full items-center gap-3 py-2.5 text-left font-bold text-acento"
          >
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-dashed border-acento text-[1.3rem] leading-none">
              +
            </span>
            <span className="min-w-0 break-words">{paraCrear ? <>Crear “{paraCrear}” como cliente nuevo</> : "Crear cliente nuevo"}</span>
          </button>
        </li>
        {clientesFiltrados.map((c) => {
          const s = datos.saldos[c.id] ?? 0;
          return (
            <li key={c.id}>
              <button type="button" onClick={() => elegirCliente(c.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                <span className="flex items-center gap-3">
                  <Avatar nombre={c.nombre} />
                  <span className="font-bold">{c.nombre}</span>
                </span>
                {s > 0 && <span className="num text-[0.82rem] font-semibold text-peligro">Debe {formatearPesos(s)}</span>}
              </button>
            </li>
          );
        })}
        {clientesFiltrados.length === 0 && <li className="py-2 text-texto-suave">No hay clientes que coincidan.</li>}
      </ul>
    </div>
  );

  const lineaOpciones = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1 text-[0.82rem] text-texto-suave">
        <span>{textoOpciones}</span>
        <button type="button" onClick={() => setOpciones((o) => !o)} className="min-h-[40px] shrink-0 font-semibold text-acento" aria-expanded={opciones}>
          {opciones ? "Listo" : "Cambiar"}
        </button>
      </div>
      {opciones && (
        <div className="flex flex-col gap-3 rounded-[20px] border border-borde bg-superficie p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-semibold">Fecha</span>
            <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-semibold">Vendió</span>
            <select value={vendidoPor} onChange={(e) => setVendidoPor(e.target.value)} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3">
              {datos.socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.85rem] font-semibold">Nota</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3" />
          </label>
        </div>
      )}
    </div>
  );

  const total = (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-texto-suave">
          {resumen.unidades} producto{resumen.unidades === 1 ? "" : "s"}
        </span>
        <span className="num text-[1.8rem] font-extrabold tracking-[-0.02em]">{formatearPesos(resumen.importe)}</span>
      </div>
      {resumen.productos > 0 && (
        <span className="text-right text-[0.72rem] text-texto-suave">
          Ganancia estimada {formatearPesos(resumen.ganancia)} · costo {formatearPesos(resumen.costoArs)} ({formatearDolares(resumen.costoUsd)})
        </span>
      )}
    </div>
  );

  const guardar = (
    <>
      {estado.duplicado && clienteNuevo
        ? avisoDuplicado(estado.duplicado, estado.error ?? "")
        : estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {resumen.problema && (items.length > 0 || hayCliente) && <p className="text-center text-[0.82rem] text-peligro">{resumen.problema}</p>}
      <button
        type="submit"
        disabled={resumen.problema !== null || enviando}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-acento text-[1.1rem] font-bold text-acento-texto transition-opacity disabled:opacity-50"
      >
        {enviando && <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}
        {enviando ? "Guardando…" : "Guardar venta"}
      </button>
    </>
  );

  return (
    <form action={enviar} className="flex flex-1 flex-col leading-[1.2]" noValidate>
      <input type="hidden" name="datos" value={datosJson} />

      <header className="flex items-center justify-between px-[18px] pt-2 pb-3 lg:px-9 lg:pt-7 lg:pb-5">
        <h1 className="text-[1.25rem] font-extrabold lg:text-[1.6rem]">Nueva venta</h1>
        <Link href={volverA} aria-label="Cerrar sin guardar" className="grid h-11 w-11 place-items-center text-texto-suave lg:hidden">
          <Icono nombre="cerrar" />
        </Link>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-[200px] lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-5 lg:px-9 lg:pb-9">
        <div className="flex flex-col gap-3">
          <div className="lg:hidden">{tarjetaCliente}</div>
          <label className="flex min-h-[50px] items-center gap-2.5 rounded-[14px] bg-superficie-2 px-3.5 text-texto-suave lg:border lg:border-borde lg:bg-superficie">
            <Icono nombre="buscar" />
            <input
              type="search"
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              placeholder="Buscar producto"
              aria-label="Buscar producto"
              className="min-w-0 flex-1 bg-transparent text-texto outline-none placeholder:text-texto-suave"
            />
          </label>
          <ul className="flex flex-col divide-y divide-borde rounded-[20px] border border-borde bg-superficie px-4 py-1 shadow-tarjeta lg:px-[18px]" aria-label="Productos">
            {productosFiltrados.map((p) => {
              const item = enCarrito.get(p.id);
              const fila = resumen.filas.find((f) => f.productoId === p.id);
              const propuesto = proponerPrecio(p.id, idElegido, productos, precios);
              const origen = item ? item.origen : propuesto.origen;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-bold">{p.nombre}</span>
                    {item ? (
                      // Caja de precio siempre visible (como antes): viene con el precio sugerido y se tipea directo.
                      <label className="flex flex-col gap-1">
                        <span className="text-[0.72rem] text-texto-suave">Precio por unidad</span>
                        <span className={`flex h-11 w-36 items-center gap-1 rounded-[12px] border bg-superficie px-2.5 ${fila?.precioError ? "border-peligro" : "border-borde"}`}>
                          <span className="font-bold text-texto-suave">$</span>
                          <input
                            inputMode="decimal"
                            value={item.precio}
                            onChange={(e) => cambiarPrecio(p.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            aria-label={`Precio de ${p.nombre}`}
                            className="num w-full min-w-0 bg-transparent text-lg font-bold text-texto outline-none"
                          />
                        </span>
                        <span className="text-[0.72rem] text-texto-suave">Propuesto: {TEXTO_ORIGEN[origen]}</span>
                      </label>
                    ) : (
                      <span className="text-[0.82rem] text-texto-suave">
                        <span className="num">{propuesto.precio !== null ? formatearPesos(propuesto.precio) : "Sin precio"}</span> · {TEXTO_ORIGEN[origen]}
                      </span>
                    )}
                    <span className="text-[0.72rem] text-texto-suave">Quedan {p.unidades}</span>
                    {fila?.precioError && <span className="text-[0.72rem] text-peligro">{fila.precioError}</span>}
                  </div>
                  {item ? (
                    <div className="flex shrink-0 items-center gap-1 rounded-[14px] bg-superficie-2 p-1">
                      <button type="button" onClick={() => sumar(p.id, -1)} aria-label={`Uno menos de ${p.nombre}`} className="grid h-10 w-10 place-items-center rounded-[11px] border border-borde bg-superficie text-[1.4rem] font-bold">
                        −
                      </button>
                      <b className="num min-w-7 text-center text-[1.1rem]" aria-label={`Cantidad de ${p.nombre}`}>
                        {item.cantidad}
                      </b>
                      <button
                        type="button"
                        onClick={() => sumar(p.id, 1)}
                        disabled={item.cantidad >= p.unidades}
                        aria-label={`Uno más de ${p.nombre}`}
                        className="grid h-10 w-10 place-items-center rounded-[11px] bg-acento text-[1.4rem] font-bold text-acento-texto disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => sumar(p.id, 1)} aria-label={`Agregar ${p.nombre}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-acento text-[1.4rem] font-bold text-acento-texto">
                      +
                    </button>
                  )}
                </li>
              );
            })}
            {productosFiltrados.length === 0 && <li className="py-3 text-texto-suave">No hay productos con stock que coincidan.</li>}
          </ul>
          <div className="lg:hidden">{lineaOpciones}</div>
        </div>

        {/* PC: cliente y resumen a la derecha. */}
        <div className="hidden flex-col gap-3 lg:flex">
          {tarjetaCliente}
          <section className="flex flex-col gap-3 rounded-[20px] border border-borde bg-superficie p-4 shadow-tarjeta" aria-label="Resumen de la venta">
            <h2 className="text-[1.05rem] font-bold">Resumen</h2>
            {resumen.filas.length === 0 ? (
              <p className="text-[0.82rem] text-texto-suave">Agregá productos con el botón +.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-[0.82rem]">
                {resumen.filas.map((f) => (
                  <li key={f.productoId} className="flex justify-between gap-3">
                    <span>
                      {f.cantidad} × {f.nombre}
                    </span>
                    <span className="num">{f.subtotal !== null ? formatearPesos(f.subtotal) : "—"}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="h-px bg-borde" />
            {total}
            {lineaOpciones}
            {guardar}
          </section>
        </div>
      </div>

      {/* Celular: total y botón fijos abajo. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 border-t border-borde bg-superficie px-4 pt-3.5 pb-[max(env(safe-area-inset-bottom),1.5rem)] lg:hidden">
        {total}
        {guardar}
      </div>
    </form>
  );
}
