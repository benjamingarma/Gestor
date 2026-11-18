import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/Aviso";
import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { EtiquetaCobro } from "@/componentes/EstadoCobro";
import { obtenerCliente } from "@/datos/clientes";
import { cuentaDeCliente, NOMBRE_MEDIO } from "@/datos/cuentas";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { esUuid } from "@/lib/uuid";
import { AnularPago, AnularSaldo, FormularioSaldoInicial } from "./AccionesCuenta";

const MENSAJES: Record<string, string> = {
  cobro: "Pago registrado.",
  "pago-anulado": "Pago anulado.",
  saldo: "Saldo del papel guardado.",
  "saldo-anulado": "Saldo anulado.",
};

export default async function PaginaCuenta({ params, searchParams }: PageProps<"/clientes/[id]/cuenta">) {
  const { id } = await params;
  const { ok } = await searchParams;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const [cliente, { cuenta, pagos, saldosIniciales }] = await Promise.all([
    obtenerCliente(socio.negocioId, id, dia),
    cuentaDeCliente(socio.negocioId, id),
  ]);
  if (!cliente) notFound();
  const mensaje = typeof ok === "string" ? MENSAJES[ok] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo={`Saldo de ${cliente.nombre}`} volverA={`/clientes/${id}`} />
      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}

      <section className="flex flex-col gap-1 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        {cuenta.debe > 0 ? (
          <>
            <span className="text-texto-suave">Nos debe</span>
            <span className="text-3xl font-bold text-peligro">{formatearPesos(cuenta.debe)}</span>
          </>
        ) : cuenta.aFavor > 0 ? (
          <>
            <span className="text-texto-suave">Tiene a favor</span>
            <span className="text-3xl font-bold text-acento">{formatearPesos(cuenta.aFavor)}</span>
          </>
        ) : (
          <span className="num text-[1.6rem] font-extrabold tracking-[-0.02em]">Está al día</span>
        )}
        <span className="text-[0.82rem] text-texto-suave">
          Compró {formatearPesos(cuenta.totalDeudas)} (incluye saldos del papel) · Pagó {formatearPesos(cuenta.totalCreditos)}
        </span>
      </section>

      <BotonEnlace href={`/cobrar/${id}`}>Registrar pago</BotonEnlace>

      <section className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-bold">Deudas</h2>
        <p className="text-[0.82rem] text-texto-suave">De la más vieja a la más nueva: los pagos se aplican en este orden.</p>
        {cuenta.deudas.length === 0 && <p className="text-texto-suave">No tiene compras.</p>}
        <ul className="flex flex-col gap-2">
          {cuenta.deudas.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta px-4 py-3">
              <span className="flex flex-col">
                {d.tipo === "venta" ? (
                  <Link href={`/ventas/${d.id}`} className="font-semibold text-acento">
                    Venta del {formatearDia(d.dia)}
                  </Link>
                ) : (
                  <span className="font-semibold">Saldo del papel ({formatearDia(d.dia)})</span>
                )}
                <span className="text-[0.82rem] text-texto-suave">
                  {formatearPesos(d.importe)} · cobrado {formatearPesos(d.cobrado)}
                </span>
              </span>
              <EtiquetaCobro importe={d.importe} cobrado={d.cobrado} saldo={d.saldo} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-bold">Pagos recibidos</h2>
        {pagos.length === 0 && <p className="text-texto-suave">Todavía no pagó nada.</p>}
        <ul className="flex flex-col gap-2">
          {pagos.map((p) => (
            <li key={p.pago_id} className={`flex flex-col gap-1 rounded-[20px] border border-borde bg-superficie shadow-tarjeta px-4 py-3 ${p.anulado_en ? "opacity-60" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{formatearDia(p.fecha)}</span>
                <span className={`text-lg font-bold ${p.anulado_en ? "line-through" : ""}`}>{formatearPesos(p.importe)}</span>
              </div>
              <span className="text-[0.82rem] text-texto-suave">
                {NOMBRE_MEDIO[p.medio]} · recibió {p.recibido_por_nombre} · cargó {p.registrado_por_nombre}
              </span>
              {p.nota && <span className="text-sm">Nota: {p.nota}</span>}
              {p.anulado_en ? (
                <span className="text-[0.82rem] text-peligro">ANULADO · {p.motivo_anulacion}</span>
              ) : (
                <AnularPago pagoId={p.pago_id} clienteId={id} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-bold">Saldos del papel</h2>
        {saldosIniciales.length === 0 && <p className="text-texto-suave">No tiene saldos anteriores a la app.</p>}
        <ul className="flex flex-col gap-2">
          {saldosIniciales.map((s) => (
            <li key={s.id} className={`flex flex-col gap-1 rounded-[20px] border border-borde bg-superficie shadow-tarjeta px-4 py-3 ${s.anulado_en ? "opacity-60" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">
                  {s.tipo === "deuda" ? "Nos debía" : "Tenía a favor"} · {formatearDia(s.fecha)}
                </span>
                <span className={`font-bold ${s.anulado_en ? "line-through" : ""}`}>{formatearPesos(s.importe)}</span>
              </div>
              {s.nota && <span className="text-sm">Nota: {s.nota}</span>}
              {s.anulado_en ? (
                <span className="text-[0.82rem] text-peligro">ANULADO · {s.motivo_anulacion}</span>
              ) : (
                <AnularSaldo saldoId={s.id} clienteId={id} />
              )}
            </li>
          ))}
        </ul>
        <FormularioSaldoInicial clienteId={id} hoy={dia} />
      </section>
    </main>
  );
}
