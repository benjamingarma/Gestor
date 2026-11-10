import { Aviso } from "@/componentes/Aviso";
import { Encabezado } from "@/componentes/Encabezado";
import { SelectorMes } from "@/componentes/SelectorMes";
import { listarAjustes, primerDiaConAjustes } from "@/datos/ajustes";
import { nombreDelMotivo, MOTIVOS } from "@/dominio/ajustes";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { esMesValido, mesDe, mesesEntre, nombreDelMes } from "@/lib/meses";
import { obtenerSocioActual } from "@/lib/sesion";
import { TarjetaAjuste } from "./TarjetaAjuste";

export default async function PaginaAjustes({ searchParams }: PageProps<"/ajustes">) {
  const { mes: pedido, ok } = await searchParams;
  const socio = await obtenerSocioActual();
  const mesActual = mesDe(hoy());
  const periodo = pedido === "todo" ? "todo" : typeof pedido === "string" && esMesValido(pedido) && pedido <= mesActual ? pedido : mesActual;

  const [ajustes, primerDia] = await Promise.all([
    listarAjustes(socio.negocioId, periodo === "todo" ? {} : { mes: periodo }),
    primerDiaConAjustes(socio.negocioId),
  ]);
  const meses = mesesEntre(primerDia && mesDe(primerDia) < mesActual ? mesDe(primerDia) : mesActual, mesActual);
  const nombrePeriodo = periodo === "todo" ? "todo el historial" : nombreDelMes(periodo).toLowerCase();

  const validos = ajustes.filter((a) => a.anulado_en === null);
  const totalArs = validos.reduce((s, a) => s + a.costo_total_ars, 0);
  const totalUsd = validos.reduce((s, a) => s + a.costo_total_usd, 0);
  const anulados = ajustes.length - validos.length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo="Regalos, pérdidas y roturas" volverA="/resumen" />
      {ok === "ajuste-anulado" && <Aviso tipo="ok">Ajuste anulado: las unidades volvieron al stock.</Aviso>}
      <SelectorMes meses={meses} actual={periodo} ruta="/ajustes" conTodo />

      <section aria-label={`Total de ${nombrePeriodo}`} className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-texto-suave">Se restó de la ganancia</span>
          <strong className={`text-xl ${totalArs > 0 ? "text-peligro" : ""}`}>−{formatearPesos(totalArs)}</strong>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-texto-suave">Costo en dólares</span>
          <span className="font-semibold">{formatearDolares(totalUsd)}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.82rem] text-texto-suave">
          {MOTIVOS.map((m) => {
            const u = validos.filter((a) => a.motivo === m.valor).reduce((s, a) => s + a.cantidad, 0);
            return (
              <span key={m.valor}>
                {nombreDelMotivo(m.valor)}: {u} u
              </span>
            );
          })}
        </div>
        {anulados > 0 && (
          <p className="text-[0.72rem] text-texto-suave">
            {anulados} ajuste{anulados === 1 ? "" : "s"} anulado{anulados === 1 ? "" : "s"} (no suman).
          </p>
        )}
        <p className="text-[0.72rem] text-texto-suave">Para cargar uno nuevo, entrá al producto desde Stock y compras.</p>
      </section>

      {ajustes.length === 0 && <p className="text-texto-suave">No hay regalos, pérdidas ni roturas en {nombrePeriodo}.</p>}
      <div id="ajustes" className="flex flex-col gap-3">
        {ajustes.map((a) => (
          <TarjetaAjuste key={a.ajuste_id} ajuste={a} conProducto volverA={`/ajustes?mes=${periodo}`} />
        ))}
      </div>
    </main>
  );
}
