import Link from "next/link";
import { Encabezado } from "@/componentes/Encabezado";
import { listarSaldos, listarUltimosPagos, NOMBRE_MEDIO } from "@/datos/cuentas";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";

export default async function PaginaCobros() {
  const socio = await obtenerSocioActual();
  const [saldos, pagos] = await Promise.all([listarSaldos(socio.negocioId), listarUltimosPagos(socio.negocioId)]);
  const deudores = saldos.filter((s) => s.saldo > 0);
  const aFavor = saldos.filter((s) => s.saldo < 0).sort((a, b) => a.saldo - b.saldo);
  const totalDeuda = deudores.reduce((s, d) => s + d.saldo, 0);
  const totalAFavor = aFavor.reduce((s, d) => s - d.saldo, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo="Pagos recibidos" volverA="/" />

      <section className="grid grid-cols-2 gap-3 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        <div className="flex flex-col">
          <span className="text-[0.82rem] text-texto-suave">Nos deben</span>
          <span className="num text-[1.6rem] font-extrabold tracking-[-0.02em] text-peligro" data-dato="nos-deben" data-centavos={totalDeuda}>
            {formatearPesos(totalDeuda)}
          </span>
          <span className="text-[0.82rem] text-texto-suave">{deudores.length} cliente{deudores.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.82rem] text-texto-suave">Saldos a favor de clientes</span>
          <span className="num text-[1.6rem] font-extrabold tracking-[-0.02em]">{formatearPesos(totalAFavor)}</span>
          <span className="text-[0.82rem] text-texto-suave">{aFavor.length} cliente{aFavor.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-bold">Deudores</h2>
        {deudores.length === 0 && <p className="text-texto-suave">Nadie debe nada. 🎉</p>}
        <ul className="flex flex-col gap-2">
          {deudores.map((d) => (
            <li key={d.cliente_id}>
              <Link
                href={`/clientes/${d.cliente_id}/cuenta`}
                className="flex min-h-[64px] items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie shadow-tarjeta px-4 py-3"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {d.nombre}
                    {d.archivado_en ? " (archivado)" : ""}
                  </span>
                  <span className="text-[0.82rem] text-texto-suave">
                    {d.ultimo_pago ? `Último pago: ${formatearDia(d.ultimo_pago)}` : "Nunca pagó"}
                  </span>
                </span>
                <span className="text-lg font-bold text-peligro">{formatearPesos(d.saldo)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {aFavor.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[1.05rem] font-bold">Con saldo a favor</h2>
          <ul className="flex flex-col gap-2">
            {aFavor.map((d) => (
              <li key={d.cliente_id}>
                <Link href={`/clientes/${d.cliente_id}/cuenta`} className="flex min-h-[52px] items-center justify-between rounded-[20px] border border-borde bg-superficie px-4 shadow-tarjeta">
                  <span>{d.nombre}</span>
                  <strong className="text-acento">{formatearPesos(-d.saldo)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[1.05rem] font-bold">Últimos pagos recibidos</h2>
        {pagos.length === 0 && <p className="text-texto-suave">Todavía no hay pagos.</p>}
        <ul className="flex flex-col gap-2">
          {pagos.map((p) => (
            <li key={p.pago_id}>
              <Link
                href={`/clientes/${p.cliente_id}/cuenta`}
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie shadow-tarjeta px-4 py-2 ${p.anulado_en ? "opacity-60" : ""}`}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{p.cliente_nombre}</span>
                  <span className="text-[0.82rem] text-texto-suave">
                    {formatearDia(p.fecha)} · {NOMBRE_MEDIO[p.medio]} · recibió {p.recibido_por_nombre}
                    {p.anulado_en ? " · ANULADO" : ""}
                  </span>
                </span>
                <span className={`font-bold ${p.anulado_en ? "line-through" : ""}`}>{formatearPesos(p.importe)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
