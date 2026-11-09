"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatearDolares, formatearPesos } from "@/lib/dinero";

export type FilaProducto = {
  id: string;
  marca: string;
  modelo: string;
  activo: boolean;
  unidades: number;
  precioGeneral: number | null;
  valorUsd: number;
  valorArs: number;
};

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function ListaProductos({ productos }: { productos: FilaProducto[] }) {
  const [busqueda, setBusqueda] = useState("");
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const lista = q ? productos.filter((p) => normalizar(`${p.marca} ${p.modelo}`).includes(q)) : productos;
    // Activos primero; dentro de cada grupo, orden alfabético (ya viene ordenado).
    return [...lista.filter((p) => p.activo), ...lista.filter((p) => !p.activo)];
  }, [busqueda, productos]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar marca o modelo"
        aria-label="Buscar producto"
        className="min-h-[52px] rounded-xl border border-borde bg-superficie px-4 text-lg"
      />
      {filtrados.length === 0 && (
        <p className="py-6 text-center text-texto-suave">
          {productos.length === 0 ? "Todavía no hay productos cargados." : "No hay productos que coincidan."}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {filtrados.map((p) => (
          <li key={p.id}>
            <Link
              href={`/productos/${p.id}`}
              className={`flex min-h-[72px] items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-4 py-3 ${p.activo ? "" : "opacity-60"}`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-lg font-semibold">
                  {p.marca} {p.modelo}
                </span>
                <span className="text-sm text-texto-suave">
                  {p.activo ? "" : "Desactivado · "}
                  {p.precioGeneral !== null ? `Precio ${formatearPesos(p.precioGeneral)}` : "Sin precio general"}
                </span>
                {p.unidades > 0 && (
                  <span className="text-sm text-texto-suave">
                    A costo: {formatearDolares(p.valorUsd)} · {formatearPesos(p.valorArs)}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className={`text-2xl font-bold ${p.unidades === 0 ? "text-texto-suave" : ""}`}>{p.unidades}</span>
                <span className="text-sm text-texto-suave">unid.</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
