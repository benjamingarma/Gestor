import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { ListaVentas } from "@/componentes/ListaVentas";
import { SelectorMes } from "@/componentes/SelectorMes";
import { cobrosDeVentas } from "@/datos/cuentas";
import { listarVentas, primerDiaConVentas } from "@/datos/ventas";
import { formatearPesos } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { esMesValido, mesDe, mesesEntre, nombreDelMes } from "@/lib/meses";
import { obtenerSocioActual } from "@/lib/sesion";

export default async function PaginaVentas({ searchParams }: PageProps<"/ventas">) {
  const { mes: mesPedido } = await searchParams;
  const socio = await obtenerSocioActual();
  const mesActual = mesDe(hoy());
  const mes = typeof mesPedido === "string" && esMesValido(mesPedido) && mesPedido <= mesActual ? mesPedido : mesActual;

  const [ventas, primerDia] = await Promise.all([listarVentas(socio.negocioId, { mes }), primerDiaConVentas(socio.negocioId)]);
  const desde = primerDia && mesDe(primerDia) < mes ? mesDe(primerDia) : mes;
  const meses = mesesEntre(desde, mesActual);
  const cobros = await cobrosDeVentas(socio.negocioId, ventas.map((v) => v.cliente_id));

  const validas = ventas.filter((v) => v.anulado_en === null);
  const total = validas.reduce((s, v) => s + v.importe, 0);
  const ganancia = validas.reduce((s, v) => s + v.ganancia, 0);
  const unidades = validas.reduce((s, v) => s + v.unidades, 0);
  const pendiente = validas.reduce((s, v) => s + (cobros.get(v.venta_id)?.saldo ?? 0), 0);
  const anuladas = ventas.length - validas.length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo="Ventas" volverA="/" />
      <BotonEnlace href="/ventas/nueva">+ Nueva venta</BotonEnlace>
      <SelectorMes meses={meses} actual={mes} ruta="/ventas" />

      <section aria-label={`Resumen de ${nombreDelMes(mes)}`} className="grid grid-cols-2 gap-3 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        <div className="flex flex-col">
          <span className="text-[0.82rem] text-texto-suave">Vendido</span>
          <span className="num text-[1.3rem] font-extrabold" data-dato="vendido-mes" data-centavos={total}>
            {formatearPesos(total)}
          </span>
          <span className="text-[0.82rem] text-texto-suave">
            {validas.length} venta{validas.length === 1 ? "" : "s"} · {unidades} u
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.82rem] text-texto-suave">Ganancia generada</span>
          <span className="num text-[1.3rem] font-extrabold">{formatearPesos(ganancia)}</span>
        </div>
        <div className="col-span-2 flex flex-col">
          <span className="text-[0.82rem] text-texto-suave">De estas ventas, saldo pendiente</span>
          <span className={`text-lg font-bold ${pendiente > 0 ? "text-peligro" : ""}`} data-falta-cobrar={pendiente}>
            {formatearPesos(pendiente)}
          </span>
        </div>
        {anuladas > 0 && (
          <p className="col-span-2 text-[0.72rem] text-texto-suave">
            {anuladas} venta{anuladas === 1 ? "" : "s"} anulada{anuladas === 1 ? "" : "s"} (no suman).
          </p>
        )}
      </section>

      <ListaVentas ventas={ventas} cobros={cobros} textoVacio={`No hay ventas en ${nombreDelMes(mes).toLowerCase()}.`} />
    </main>
  );
}
