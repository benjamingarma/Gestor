"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/componentes/Iconos";
import { Avatar } from "@/componentes/UI";
import { formatearPesos } from "@/lib/dinero";
import { coincide } from "@/lib/texto";

export type ClienteParaCobrar = {
  id: string;
  nombre: string;
  /** > 0 debe; < 0 tiene a favor (v_cuentas_clientes). */
  saldo: number;
  /** Días desde la deuda más vieja que sigue pendiente (solo si debe). */
  diasDeudaMasVieja: number | null;
};

const hace = (n: number) => (n === 0 ? "hoy" : n === 1 ? "hace 1 día" : `hace ${n} días`);

/**
 * Lista "quién debe" de la pantalla Cobrar (maqueta 3, paso previo en el celular; columna izquierda en PC).
 * El buscador encuentra a cualquier cliente: si no debe, el cobro le queda a favor.
 */
export function ListaQuienDebe({ deudores, todos, totalDeuda, seleccionado }: { deudores: ClienteParaCobrar[]; todos: ClienteParaCobrar[]; totalDeuda: number; seleccionado?: string }) {
  const [busqueda, setBusqueda] = useState("");
  const buscando = busqueda.trim() !== "";
  const lista = buscando ? todos.filter((c) => coincide(c.nombre, busqueda)).sort((a, b) => b.saldo - a.saldo).slice(0, 30) : deudores;

  const buscador = (
    <label className="flex min-h-[50px] items-center gap-2.5 rounded-[14px] bg-superficie-2 px-3.5 text-texto-suave">
      <Icono nombre="buscar" />
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar cliente"
        aria-label="Buscar cliente"
        className="min-w-0 flex-1 bg-transparent text-texto outline-none placeholder:text-texto-suave"
      />
    </label>
  );

  const detalle = (c: ClienteParaCobrar) =>
    c.saldo > 0 ? (c.diasDeudaMasVieja !== null ? `deuda más vieja ${hace(c.diasDeudaMasVieja)}` : "") : c.saldo < 0 ? `tiene ${formatearPesos(-c.saldo)} a favor` : "no debe nada";

  return (
    <div className="flex flex-col gap-3 leading-[1.2] lg:gap-2 lg:rounded-[20px] lg:border lg:border-borde lg:bg-superficie lg:p-4 lg:shadow-tarjeta">
      {buscador}
      <span className="px-0.5 pt-1 text-[0.72rem] font-bold tracking-[0.04em] text-texto-suave lg:pt-1.5">
        {buscando ? (
          "RESULTADOS"
        ) : (
          <>
            <span className="lg:hidden">
              NOS DEBEN ·{" "}
              <span className="num" data-dato="nos-deben" data-centavos={totalDeuda}>
                {formatearPesos(totalDeuda)}
              </span>
            </span>
            <span className="hidden lg:inline">LOS QUE MÁS DEBEN</span>
          </>
        )}
      </span>
      {lista.length === 0 ? (
        <p className="rounded-[20px] border border-borde bg-superficie p-4 text-texto-suave lg:border-0 lg:p-2">
          {buscando ? "No hay clientes que coincidan." : "Nadie debe nada."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-[20px] border border-borde bg-superficie px-4 py-1 shadow-tarjeta lg:border-0 lg:p-0 lg:shadow-none" aria-label="Clientes para cobrar">
          {lista.map((c) => {
            const elegido = c.id === seleccionado;
            return (
              <li key={c.id}>
                <Link
                  href={`/cobrar/${c.id}`}
                  aria-current={elegido ? "true" : undefined}
                  className={`flex items-center justify-between gap-3 py-[11px] lg:rounded-[10px] lg:px-2 lg:py-2.5 ${elegido ? "lg:bg-acento-suave" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="lg:hidden">
                      <Avatar nombre={c.nombre} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className={`truncate font-bold ${elegido ? "" : "lg:font-normal"}`}>{c.nombre}</span>
                      {detalle(c) && <span className="text-[0.72rem] text-texto-suave lg:hidden">{detalle(c)}</span>}
                    </span>
                  </span>
                  {c.saldo > 0 ? (
                    <span className="num shrink-0 font-bold text-peligro">{formatearPesos(c.saldo)}</span>
                  ) : c.saldo < 0 ? (
                    <span className="num shrink-0 text-[0.82rem] font-semibold text-acento">a favor</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <span className="px-1 text-[0.82rem] text-texto-suave lg:hidden">¿No debe pero paga por adelantado? Buscalo arriba: se le guarda a favor.</span>
    </div>
  );
}
