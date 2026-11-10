"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EtiquetaEstadoVisita } from "@/componentes/EstadoVisita";
import { compararParaVisitar, hayQueVisitar, type EstadoVisita } from "@/dominio/visitas";
import { enlaceWhatsApp } from "@/lib/telefono";
import { BotonVisitado } from "./BotonVisitado";

export type FilaCliente = { id: string; nombre: string; telefono: string | null; estado: EstadoVisita };
type Vista = "visitar" | "todos" | "archivados";

function normalizar(t: string) {
  return t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function ListaClientes({ clientes, hoy, vistaInicial }: { clientes: FilaCliente[]; hoy: string; vistaInicial: Vista }) {
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<Vista>(vistaInicial);

  const grupos = useMemo(() => {
    const activos = clientes.filter((c) => c.estado.tipo !== "archivado");
    return {
      visitar: activos.filter((c) => hayQueVisitar(c.estado)).sort((a, b) => compararParaVisitar(a.estado, b.estado)),
      todos: activos,
      archivados: clientes.filter((c) => c.estado.tipo === "archivado"),
    };
  }, [clientes]);

  const q = normalizar(busqueda.trim());
  const qDigitos = busqueda.replace(/\D/g, "");
  // Al buscar, se busca en todos los clientes activos (y en archivados si estás en esa pestaña).
  const base = q ? (vista === "archivados" ? grupos.archivados : grupos.todos) : grupos[vista];
  const lista = q
    ? base.filter(
        (c) => normalizar(c.nombre).includes(q) || (qDigitos.length >= 3 && (c.telefono ?? "").replace(/\D/g, "").includes(qDigitos)),
      )
    : base;

  const pestañas: { id: Vista; texto: string }[] = [
    { id: "visitar", texto: `A visitar (${grupos.visitar.length})` },
    { id: "todos", texto: `Todos (${grupos.todos.length})` },
    { id: "archivados", texto: `Archivados (${grupos.archivados.length})` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o teléfono"
        aria-label="Buscar cliente"
        className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3.5 text-lg"
      />
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-1">
        {pestañas.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={vista === p.id}
            onClick={() => setVista(p.id)}
            className={`boton-toque min-h-[44px] rounded-[11px] px-1 text-[0.85rem] font-bold ${vista === p.id ? "bg-acento text-acento-texto" : "text-texto"}`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <p className="py-6 text-center text-texto-suave">
          {q
            ? "No hay clientes que coincidan."
            : vista === "visitar"
              ? "No hay nadie para visitar en los próximos días. 🎉"
              : vista === "archivados"
                ? "No hay clientes archivados."
                : "Todavía no hay clientes."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {lista.map((c) => {
          const wa = enlaceWhatsApp(c.telefono);
          return (
            <li key={c.id} className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-3">
              <Link href={`/clientes/${c.id}`} className="flex min-h-[48px] flex-col justify-center">
                <span className="text-[1.05rem] font-bold">{c.nombre}</span>
                <EtiquetaEstadoVisita estado={c.estado} />
              </Link>
              {c.estado.tipo !== "archivado" && (
                <div className={`grid gap-2 ${wa ? "grid-cols-2" : "grid-cols-1"}`}>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="boton-toque flex min-h-[44px] items-center justify-center rounded-[12px] border border-borde text-[0.95rem] font-bold"
                    >
                      WhatsApp
                    </a>
                  )}
                  <BotonVisitado key={JSON.stringify(c.estado)} clienteId={c.id} volverA="lista" hoy={hoy} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
