import Link from "next/link";
import { Encabezado } from "@/componentes/Encabezado";
import { SelectorMes } from "@/componentes/SelectorMes";
import { listarClientes } from "@/datos/clientes";
import { leerDatosTablero } from "@/datos/resumen";
import { vigenteEn } from "@/dominio/ganancia";
import { armarTablero } from "@/dominio/tablero";
import { compararParaVisitar } from "@/dominio/visitas";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { esMesValido, mesDe, mesesEntre, nombreDelMes } from "@/lib/meses";
import { obtenerSocioActual } from "@/lib/sesion";
import { EtiquetaEstadoVisita } from "@/componentes/EstadoVisita";

const NOMBRE_MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", mercado_pago: "Mercado Pago" };

function Tarjeta({ titulo, children, enlace }: { titulo: string; children: React.ReactNode; enlace?: { href: string; texto: string } }) {
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
      <h2 className="text-[1.05rem] font-bold">{titulo}</h2>
      {children}
      {enlace && (
        <Link href={enlace.href} className="min-h-[44px] content-center text-[0.9rem] font-semibold text-acento">
          {enlace.texto} →
        </Link>
      )}
    </section>
  );
}

/** Importe en dólares y en pesos, uno debajo del otro. */
function Doble({ usd, ars }: { usd: number; ars: number }) {
  return (
    <span className="flex flex-col items-end">
      <span>{formatearDolares(usd)}</span>
      <span>{formatearPesos(ars)}</span>
    </span>
  );
}

function Fila({ etiqueta, valor, fuerte, rojo, dato }: { etiqueta: React.ReactNode; valor: React.ReactNode; fuerte?: boolean; rojo?: boolean; dato?: [string, number] }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${fuerte ? "text-lg font-bold" : ""}`}>
      <span className={fuerte ? "" : "text-texto-suave"}>{etiqueta}</span>
      <span className={`num shrink-0 whitespace-nowrap text-right ${rojo ? "text-peligro" : ""} ${fuerte ? "" : "font-semibold"}`} data-dato={dato?.[0]} data-centavos={dato?.[1]}>
        {valor}
      </span>
    </div>
  );
}

export default async function PaginaResumen({ searchParams }: PageProps<"/resumen">) {
  const { mes: pedido } = await searchParams;
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const mesActual = mesDe(dia);
  const periodo = pedido === "todo" ? "todo" : typeof pedido === "string" && esMesValido(pedido) && pedido <= mesActual ? pedido : mesActual;

  const [datos, clientes] = await Promise.all([leerDatosTablero(socio.negocioId), listarClientes(socio.negocioId, dia)]);
  const { socios, vigencias, ganancias, perdidas, cobros, capital } = datos;
  const saldos = datos.saldos;

  const primerMes = [ganancias[0]?.dia, perdidas[0]?.dia, cobros[0]?.dia].filter(Boolean).sort()[0];
  const meses = mesesEntre(primerMes && mesDe(primerMes) < mesActual ? mesDe(primerMes) : mesActual, mesActual);
  const nombrePeriodo = periodo === "todo" ? "todo el historial" : nombreDelMes(periodo).toLowerCase();

  // Mismos totales que Inicio y Cobrar (src/dominio/tablero.ts).
  const t = armarTablero(datos, periodo);
  const { ventas, ganancia, acumulada, cobrado } = t;
  const ajustes = t.perdidas;
  const porcentajesHoy = vigenteEn(vigencias, dia, socios);

  const nosDeben = saldos.filter((s) => s.saldo > 0);
  const totalNosDeben = t.nosDeben.total;
  const totalAFavor = t.aFavor.total;
  const aVisitar = clientes.filter((c) => c.estado.tipo === "atrasado" || c.estado.tipo === "hoy").sort((a, b) => compararParaVisitar(a.estado, b.estado));
  const cierra = t.capitalCierra;
  const pct = (socioId: string) => (porcentajesHoy.find((p) => p.socioId === socioId)?.centesimos ?? 0) / 100;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo="Resumen" volverA="/" />
      <SelectorMes meses={meses} actual={periodo} ruta="/resumen" conTodo />

      <Tarjeta titulo={`Ganancia · ${nombrePeriodo}`} enlace={{ href: "/resumen/reparto", texto: "Ver o cambiar el reparto" }}>
        <Fila etiqueta="Ganancia de las ventas" valor={formatearPesos(ganancia.bruta)} />
        <Fila
          etiqueta={
            <Link href={`/ajustes?mes=${periodo}`} className="text-acento">
              − Pérdidas por ajustes de stock{ajustes.unidades > 0 ? ` (${ajustes.unidades} u)` : ""}
            </Link>
          }
          valor={formatearPesos(ganancia.perdidas)}
          rojo={ganancia.perdidas > 0}
        />
        <Fila etiqueta="Ganancia neta" valor={formatearPesos(ganancia.neta)} fuerte rojo={ganancia.neta < 0} dato={["ganancia-neta-mes", ganancia.neta]} />
        <div className="mt-1 flex flex-col gap-1 border-t border-borde pt-2">
          {ganancia.partes.map((p) => (
            <Fila key={p.socioId} etiqueta={`Le corresponde a ${p.nombre}`} valor={formatearPesos(p.importe)} />
          ))}
        </div>
        <p className="text-[0.72rem] text-texto-suave">
          Es lo que se ganó con las ventas (precio − costo de la mercadería), menos el costo de lo regalado, perdido o
          roto, se haya cobrado o no. No es plata
          disponible: parte puede estar sin cobrar, y el costo de la mercadería es capital, no ganancia.
        </p>
      </Tarjeta>

      <Tarjeta titulo={`Ventas · ${nombrePeriodo}`} enlace={periodo === "todo" ? undefined : { href: `/ventas?mes=${periodo}`, texto: "Ver las ventas" }}>
        <Fila etiqueta="Vendido" valor={formatearPesos(ventas.importe)} dato={["vendido-mes", ventas.importe]} />
        <Fila etiqueta="Costo de la mercadería vendida" valor={<Doble usd={ventas.costoUsd} ars={ventas.costoArs} />} />
        <Fila etiqueta="Ventas · unidades" valor={`${ventas.ventas} · ${ventas.unidades} u`} />
      </Tarjeta>

      <Tarjeta titulo={`Dinero cobrado · ${nombrePeriodo}`} enlace={{ href: "/cobros", texto: "Ver cobros" }}>
        <Fila etiqueta="Total cobrado" valor={formatearPesos(cobrado.total)} fuerte dato={["cobrado-mes", cobrado.total]} />
        {[...cobrado.porMedio].map(([m, t]) => (
          <Fila key={m} etiqueta={NOMBRE_MEDIO[m] ?? m} valor={formatearPesos(t)} />
        ))}
        {cobrado.porSocio.size > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-t border-borde pt-2">
            {[...cobrado.porSocio.values()].map((s) => (
              <Fila key={s.nombre} etiqueta={`Recibió ${s.nombre}`} valor={formatearPesos(s.total)} />
            ))}
          </div>
        )}
        <p className="text-[0.72rem] text-texto-suave">Incluye lo cobrado de deudas viejas y la recuperación del costo: no es todo ganancia.</p>
      </Tarjeta>

      <Tarjeta titulo="Hoy">
        <Fila etiqueta={<Link href="/cobros" className="text-acento">Nos deben</Link>} valor={formatearPesos(totalNosDeben)} rojo={totalNosDeben > 0} dato={["nos-deben", totalNosDeben]} />
        <Fila etiqueta="Saldos a favor de clientes" valor={formatearPesos(totalAFavor)} />
        <Fila
          etiqueta={<Link href="/productos" className="text-acento">Capital en mercadería</Link>}
          valor={<Doble usd={capital.stock_usd} ars={capital.stock_ars} />}
          dato={["capital-ars", capital.stock_ars]}
        />
        <div className="mt-1 flex flex-col gap-1 border-t border-borde pt-2">
          <Fila etiqueta="Ganancia acumulada (todo el historial)" valor={formatearPesos(acumulada.neta)} />
          {acumulada.partes.map((p) => (
            <Fila key={p.socioId} etiqueta={`${p.nombre} (hoy ${pct(p.socioId).toLocaleString("es-AR")} %)`} valor={formatearPesos(p.importe)} />
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Capital (desde el inicio)">
        <Fila etiqueta="Invertido en compras" valor={<Doble usd={capital.invertido_usd} ars={capital.invertido_ars} />} fuerte />
        <Fila etiqueta="= Costo de lo vendido" valor={<Doble usd={capital.vendido_usd} ars={capital.vendido_ars} />} />
        <Fila etiqueta="+ Pérdidas por ajustes" valor={<Doble usd={capital.perdidas_usd} ars={capital.perdidas_ars} />} />
        <Fila etiqueta="+ Queda en stock" valor={<Doble usd={capital.stock_usd} ars={capital.stock_ars} />} />
        <p className={`text-sm font-semibold ${cierra ? "text-acento" : "text-peligro"}`}>
          {cierra ? "✓ Las cuentas del capital cierran en dólares y en pesos." : "⚠ Las cuentas del capital no cierran: avisá para revisarlo."}
        </p>
      </Tarjeta>

      <Tarjeta titulo={`A visitar (${aVisitar.length})`} enlace={{ href: "/clientes", texto: "Ver clientes" }}>
        {aVisitar.length === 0 && <p className="text-texto-suave">Nadie atrasado ni para hoy.</p>}
        <ul className="flex flex-col gap-1">
          {aVisitar.slice(0, 5).map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="flex min-h-[44px] items-center justify-between gap-2">
                <span>{c.nombre}</span>
                <EtiquetaEstadoVisita estado={c.estado} />
              </Link>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo={`Quién debe plata (${nosDeben.length})`} enlace={{ href: "/cobros", texto: "Ver todos" }}>
        {nosDeben.length === 0 && <p className="text-texto-suave">Nadie debe nada.</p>}
        <ul className="flex flex-col gap-1">
          {nosDeben.slice(0, 5).map((d) => (
            <li key={d.cliente_id}>
              <Link href={`/clientes/${d.cliente_id}/cuenta`} className="flex min-h-[44px] items-center justify-between gap-2">
                <span>{d.nombre}</span>
                <strong className="text-peligro">{formatearPesos(d.saldo)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </main>
  );
}
