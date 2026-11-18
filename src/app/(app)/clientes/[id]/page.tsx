import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/Aviso";
import { Encabezado } from "@/componentes/Encabezado";
import { EtiquetaEstadoVisita } from "@/componentes/EstadoVisita";
import { BotonEnlace } from "@/componentes/BotonEnlace";
import { ListaVentas } from "@/componentes/ListaVentas";
import { obtenerCliente } from "@/datos/clientes";
import { cobrosDeVentas, saldoDeCliente } from "@/datos/cuentas";
import { listarProductosActivos } from "@/datos/inventario";
import { listarPreciosEspeciales, listarVentas, ultimaVentaDeCliente } from "@/datos/ventas";
import { Icono } from "@/componentes/Iconos";
import { resumenUltimaVenta } from "@/componentes/UltimaVenta";
import { proximaVisita, ultimaActividad } from "@/dominio/visitas";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { enlaceLlamada, enlaceWhatsApp } from "@/lib/telefono";
import { esUuid } from "@/lib/uuid";
import { editarCliente } from "../acciones";
import { BotonVisitado } from "../BotonVisitado";
import { FormularioCliente } from "../FormularioCliente";
import { ArchivarCliente, DeshacerVisita } from "./AccionesCliente";
import { PreciosEspeciales } from "./PreciosEspeciales";

const MENSAJES: Record<string, string> = {
  creado: "Cliente creado.",
  editado: "Cambios guardados.",
  visitado: "Visita registrada.",
  deshecha: "Visita deshecha.",
  archivado: "Cliente archivado.",
  desarchivado: "Cliente desarchivado.",
  precio: "Precio especial guardado.",
  "precio-quitado": "Precio especial quitado.",
};

export default async function PaginaCliente({ params, searchParams }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const { ok } = await searchParams;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const cliente = await obtenerCliente(socio.negocioId, id, dia);
  if (!cliente) notFound();
  const [ventas, precios, productos, saldo, cobros, ultima] = await Promise.all([
    listarVentas(socio.negocioId, { clienteId: id, limite: 5 }),
    listarPreciosEspeciales(id),
    listarProductosActivos(socio.negocioId),
    saldoDeCliente(socio.negocioId, id),
    cobrosDeVentas(socio.negocioId, [id]),
    ultimaVentaDeCliente(socio.negocioId, id),
  ]);

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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo={cliente.nombre} volverA="/clientes" />
      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}

      <section className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        {cliente.estado.tipo !== "al_dia" && <EtiquetaEstadoVisita estado={cliente.estado} />}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <dt className="text-[0.82rem] text-texto-suave">Última visita o compra</dt>
            <dd className="font-semibold">{actividad ? formatearDia(actividad) : "Nunca"}</dd>
          </div>
          <div>
            <dt className="text-[0.82rem] text-texto-suave">Próxima visita</dt>
            <dd className="font-semibold">{cliente.archivado ? "—" : formatearDia(proxima)}</dd>
          </div>
          <div>
            <dt className="text-[0.82rem] text-texto-suave">Visitar cada</dt>
            <dd className="font-semibold">{cliente.intervaloDias} días</dd>
          </div>
          <div>
            <dt className="text-[0.82rem] text-texto-suave">Teléfono</dt>
            <dd className="font-semibold break-words">{cliente.telefono ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[0.82rem] text-texto-suave">Dirección</dt>
            <dd className="font-semibold break-words">{cliente.direccion ?? "—"}</dd>
          </div>
        </dl>
        {cliente.notas && <p className="whitespace-pre-line text-base">{cliente.notas}</p>}
      </section>

      {(wa || tel) && (
        <div className={`grid gap-2 ${wa && tel ? "grid-cols-2" : "grid-cols-1"}`}>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="boton-toque flex min-h-[56px] items-center justify-center rounded-2xl border border-borde bg-superficie text-[1.1rem] font-bold">
              WhatsApp
            </a>
          )}
          {tel && (
            <a href={tel} className="boton-toque flex min-h-[56px] items-center justify-center rounded-2xl border border-borde bg-superficie text-[1.1rem] font-bold">
              Llamar
            </a>
          )}
        </div>
      )}

      <section className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[0.82rem] text-texto-suave">Saldo pendiente (lo que nos debe)</span>
          <span className={`num text-[1.6rem] font-extrabold tracking-[-0.02em] ${saldo > 0 ? "text-peligro" : saldo < 0 ? "text-acento" : ""}`}>
            {saldo > 0 ? `Debe ${formatearPesos(saldo)}` : saldo < 0 ? `${formatearPesos(-saldo)} a favor` : "Al día"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <BotonEnlace href={`/cobrar/${cliente.id}`} variante={saldo > 0 ? "principal" : "secundario"}>
            Registrar pago
          </BotonEnlace>
          <BotonEnlace href={`/clientes/${cliente.id}/cuenta`} variante="secundario">
            Ver detalle
          </BotonEnlace>
        </div>
      </section>

      {!cliente.archivado && (
        <BotonEnlace href={`/ventas/nueva?cliente=${cliente.id}`}>+ Nueva venta</BotonEnlace>
      )}

      {!cliente.archivado && ultima && (
        // Repetir la última venta no anulada: abre la venta con esos productos y cantidades, a precios de hoy.
        <div className="-mt-2 flex flex-col gap-1">
          <BotonEnlace href={`/ventas/nueva?cliente=${cliente.id}&repetir=1`} variante="secundario">
            <span className="flex items-center justify-center gap-2">
              <Icono nombre="repetir" className="h-5 w-5" />
              Repetir última venta
            </span>
          </BotonEnlace>
          <span className="text-center text-[0.72rem] text-texto-suave">{resumenUltimaVenta(ultima)}</span>
        </div>
      )}

      {!cliente.archivado && (
        // key: al cambiar la última visita se monta de nuevo y genera otro identificador.
        <BotonVisitado key={cliente.ultimaVisitaId ?? "sin-visitas"} clienteId={cliente.id} volverA="ficha" hoy={dia} conFecha />
      )}

      {cliente.ultimaVisitaId && cliente.ultimaVisita && (
        <section className="flex flex-col gap-1 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
          <span className="text-[0.82rem] text-texto-suave">Última visita marcada</span>
          <span className="font-semibold">{formatearDia(cliente.ultimaVisita)}</span>
          <DeshacerVisita visitaId={cliente.ultimaVisitaId} clienteId={cliente.id} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Últimas ventas</h2>
        <ListaVentas ventas={ventas} mostrarCliente={false} cobros={cobros} />
      </section>

      <PreciosEspeciales
        clienteId={cliente.id}
        precios={precios}
        productos={productos.map((p) => ({ id: p.id, nombre: `${p.marca} ${p.modelo}` }))}
      />

      <details className="rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        <summary className="min-h-[44px] cursor-pointer content-center text-[1.05rem] font-bold">Editar cliente</summary>
        <div className="mt-3">
          <FormularioCliente
            accion={editarCliente}
            textoBoton="Guardar cambios"
            inicial={{
              id: cliente.id,
              nombre: cliente.nombre,
              telefono: cliente.telefono ?? "",
              direccion: cliente.direccion ?? "",
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
