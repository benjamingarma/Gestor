import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/Aviso";
import { Encabezado } from "@/componentes/Encabezado";
import { EtiquetaEstadoVisita } from "@/componentes/EstadoVisita";
import { obtenerCliente } from "@/datos/clientes";
import { proximaVisita, ultimaActividad } from "@/dominio/visitas";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { enlaceLlamada, enlaceWhatsApp } from "@/lib/telefono";
import { esUuid } from "@/lib/uuid";
import { editarCliente } from "../acciones";
import { BotonVisitado } from "../BotonVisitado";
import { FormularioCliente } from "../FormularioCliente";
import { ArchivarCliente, DeshacerVisita } from "./AccionesCliente";

const MENSAJES: Record<string, string> = {
  creado: "Cliente creado.",
  editado: "Cambios guardados.",
  visitado: "Visita registrada.",
  deshecha: "Visita deshecha.",
  archivado: "Cliente archivado.",
  desarchivado: "Cliente desarchivado.",
};

export default async function PaginaCliente({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const { ok } = await searchParams;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const cliente = await obtenerCliente(socio.negocioId, id, dia);
  if (!cliente) notFound();

  const wa = enlaceWhatsApp(cliente.telefono);
  const tel = enlaceLlamada(cliente.telefono);
  const actividad = ultimaActividad({
    fechaAlta: cliente.fechaAlta,
    intervaloDias: cliente.intervaloDias,
    ultimaVisita: cliente.ultimaVisita,
    ultimaVenta: cliente.ultimaVenta,
    ultimaVisitaInicial: cliente.ultimaVisitaInicial,
    archivado: cliente.archivado,
  });
  const proxima = proximaVisita({
    fechaAlta: cliente.fechaAlta,
    intervaloDias: cliente.intervaloDias,
    ultimaVisita: cliente.ultimaVisita,
    ultimaVenta: cliente.ultimaVenta,
    ultimaVisitaInicial: cliente.ultimaVisitaInicial,
    archivado: false,
  });
  const mensaje = typeof ok === "string" ? MENSAJES[ok] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado titulo={cliente.nombre} volverA="/clientes" />
      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}

      <section className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-4">
        {cliente.estado.tipo !== "al_dia" && <EtiquetaEstadoVisita estado={cliente.estado} />}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <dt className="text-sm text-texto-suave">Última visita o compra</dt>
            <dd className="font-semibold">{actividad ? formatearDia(actividad) : "Nunca"}</dd>
          </div>
          <div>
            <dt className="text-sm text-texto-suave">Próxima visita</dt>
            <dd className="font-semibold">{cliente.archivado ? "—" : formatearDia(proxima)}</dd>
          </div>
          <div>
            <dt className="text-sm text-texto-suave">Visitar cada</dt>
            <dd className="font-semibold">{cliente.intervaloDias} días</dd>
          </div>
          <div>
            <dt className="text-sm text-texto-suave">Teléfono</dt>
            <dd className="font-semibold break-words">{cliente.telefono ?? "—"}</dd>
          </div>
        </dl>
        {cliente.notas && <p className="whitespace-pre-line text-base">{cliente.notas}</p>}
      </section>

      {(wa || tel) && (
        <div className={`grid gap-2 ${wa && tel ? "grid-cols-2" : "grid-cols-1"}`}>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center justify-center rounded-xl border border-borde bg-superficie text-lg font-semibold">
              WhatsApp
            </a>
          )}
          {tel && (
            <a href={tel} className="flex min-h-[52px] items-center justify-center rounded-xl border border-borde bg-superficie text-lg font-semibold">
              Llamar
            </a>
          )}
        </div>
      )}

      {!cliente.archivado && (
        // key: al cambiar la última visita se monta de nuevo y genera otro identificador.
        <BotonVisitado key={cliente.ultimaVisitaId ?? "sin-visitas"} clienteId={cliente.id} volverA="ficha" hoy={dia} conFecha />
      )}

      {cliente.ultimaVisitaId && cliente.ultimaVisita && (
        <section className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-4">
          <span className="text-sm text-texto-suave">Última visita marcada</span>
          <span className="font-semibold">{formatearDia(cliente.ultimaVisita)}</span>
          <DeshacerVisita visitaId={cliente.ultimaVisitaId} clienteId={cliente.id} />
        </section>
      )}

      <details className="rounded-xl border border-borde bg-superficie p-4">
        <summary className="min-h-[44px] cursor-pointer content-center text-lg font-semibold">Editar cliente</summary>
        <div className="mt-3">
          <FormularioCliente
            accion={editarCliente}
            textoBoton="Guardar cambios"
            inicial={{
              id: cliente.id,
              nombre: cliente.nombre,
              telefono: cliente.telefono ?? "",
              notas: cliente.notas ?? "",
              intervalo: String(cliente.intervaloDias),
            }}
          />
        </div>
      </details>

      <ArchivarCliente clienteId={cliente.id} archivado={cliente.archivado} />
    </main>
  );
}
