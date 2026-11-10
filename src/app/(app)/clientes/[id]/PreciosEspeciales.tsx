"use client";

import { useActionState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { formatearPesos } from "@/lib/dinero";
import { fijarPrecioEspecial } from "../../ventas/acciones";

type Props = {
  clienteId: string;
  precios: { productoId: string; producto: string; precio: number }[];
  productos: { id: string; nombre: string }[];
};

function QuitarPrecio({ clienteId, productoId, producto }: { clienteId: string; productoId: string; producto: string }) {
  const [estado, enviar, enviando] = useActionState(fijarPrecioEspecial, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="productoId" value={productoId} />
      <input type="hidden" name="quitar" value="si" />
      <button type="submit" disabled={enviando} className="min-h-[44px] px-2 text-peligro" aria-label={`Quitar precio especial de ${producto}`}>
        Quitar
      </button>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
    </form>
  );
}

export function PreciosEspeciales({ clienteId, precios, productos }: Props) {
  const [estado, enviar, enviando] = useActionState(fijarPrecioEspecial, {});
  return (
    <section id="precios" className="flex flex-col gap-3 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
      <h2 className="text-lg font-bold">Precios especiales</h2>
      <p className="text-[0.82rem] text-texto-suave">
        Al venderle, se propone primero su precio especial; si no tiene, el último que pagó; si no, el general.
      </p>
      {precios.length === 0 && <p className="text-texto-suave">No tiene precios especiales.</p>}
      <ul className="flex flex-col gap-1">
        {precios.map((p) => (
          <li key={p.productoId} className="flex items-center justify-between gap-2 border-b border-borde py-1">
            <span>{p.producto}</span>
            <span className="flex items-center gap-2">
              <strong>{formatearPesos(p.precio)}</strong>
              <QuitarPrecio clienteId={clienteId} productoId={p.productoId} producto={p.producto} />
            </span>
          </li>
        ))}
      </ul>
      <details>
        <summary className="min-h-[44px] cursor-pointer content-center font-medium text-acento">+ Fijar o cambiar un precio especial</summary>
        <form action={enviar} className="mt-2 flex flex-col gap-3">
          <input type="hidden" name="clienteId" value={clienteId} />
          <label className="flex flex-col gap-1">
            <span className="font-medium">Producto</span>
            <select name="productoId" defaultValue="" className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3 text-lg">
              <option value="">Elegí un producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Precio por unidad</span>
            <input name="precio" inputMode="decimal" placeholder="Ej: 10.500" className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3.5 text-lg" />
          </label>
          {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
          <Boton type="submit" variante="secundario" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar precio especial"}
          </Boton>
        </form>
      </details>
    </section>
  );
}
