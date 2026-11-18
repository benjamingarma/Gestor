import Link from "next/link";
import { Icono, Logo } from "@/componentes/Iconos";
import { AvisoInfo, Avatar, Chip, Tarjeta } from "@/componentes/UI";
import { listarClientes } from "@/datos/clientes";
import { deudasMasViejas } from "@/datos/cuentas";
import { leerDatosTablero } from "@/datos/resumen";
import { armarTablero } from "@/dominio/tablero";
import { compararParaVisitar } from "@/dominio/visitas";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { diasEntre, formatearDiaLargo, hoy } from "@/lib/fechas";
import { mesDe, nombreDelMes } from "@/lib/meses";
import { obtenerSocioActual } from "@/lib/sesion";

/** Cuántos clientes se muestran en las listas del Inicio (el resto, a un toque). */
const MAXIMO_LISTA = 5;

const dias = (n: number) => (n === 1 ? "1 día" : `${n} días`);

/** Inicio (maqueta docs/maquetas, pantalla 1). Los totales salen de armarTablero, igual que en Resumen. */
export default async function PaginaInicio() {
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const mes = mesDe(dia);
  const [datos, clientes] = await Promise.all([leerDatosTablero(socio.negocioId), listarClientes(socio.negocioId, dia)]);
  const t = armarTablero(datos, mes);

  const deudores = datos.saldos.filter((s) => s.saldo > 0);
  const masViejas = await deudasMasViejas(socio.negocioId, deudores.map((d) => d.cliente_id));
  const masVieja = deudores
    .filter((d) => masViejas.has(d.cliente_id))
    .map((d) => ({ nombre: d.nombre, dia: masViejas.get(d.cliente_id)! }))
    .sort((a, b) => (a.dia < b.dia ? -1 : 1))[0];
  const aVisitar = clientes.filter((c) => c.estado.tipo === "atrasado" || c.estado.tipo === "hoy").sort((a, b) => compararParaVisitar(a.estado, b.estado));
  const nombreMes = nombreDelMes(mes).split(" ")[0];
  const netaNegativa = t.ganancia.neta < 0;

  const nosDeben = (
    <Tarjeta className="flex flex-col gap-2 lg:order-none" aria-label="Nos deben">
      <span className="text-[0.82rem] text-texto-suave">Nos deben</span>
      <div className="flex items-center justify-between gap-3">
        <span className={`num text-[2.1rem] font-extrabold tracking-[-0.02em] ${t.nosDeben.total > 0 ? "text-peligro" : ""}`} data-dato="nos-deben" data-centavos={t.nosDeben.total}>
          {formatearPesos(t.nosDeben.total)}
        </span>
        <Link href="/cobrar" className="flex min-h-[40px] items-center rounded-xl bg-acento px-3.5 text-[0.9rem] font-bold text-acento-texto">
          Ver deudores
        </Link>
      </div>
      <span className="text-[0.82rem] text-texto-suave">
        {t.nosDeben.clientes === 0
          ? "Nadie debe nada."
          : `${t.nosDeben.clientes} cliente${t.nosDeben.clientes === 1 ? "" : "s"}` +
            (masVieja ? ` · la deuda más vieja es de ${masVieja.nombre} (hace ${dias(diasEntre(masVieja.dia, dia))})` : "")}
      </span>
    </Tarjeta>
  );

  const visitar = (
    <Tarjeta className="flex flex-col gap-2" aria-label="A visitar hoy">
      <div className="flex items-center justify-between">
        <h2 className="text-[1.05rem] font-bold">A visitar hoy</h2>
        {aVisitar.length > 0 && <Chip tono="peligro">{aVisitar.length}</Chip>}
      </div>
      {aVisitar.length === 0 ? (
        <p className="text-texto-suave">Nadie para visitar hoy.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {aVisitar.slice(0, MAXIMO_LISTA).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/clientes/${c.id}`} className="flex min-w-0 items-center gap-3">
                <Avatar nombre={c.nombre} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-bold">{c.nombre}</span>
                  {c.estado.tipo === "atrasado" ? (
                    <Chip tono="peligro" chica>Atrasado {dias(c.estado.diasAtraso)}</Chip>
                  ) : (
                    <Chip tono="aviso" chica>Le toca hoy</Chip>
                  )}
                </span>
              </Link>
              <Link href={`/ventas/nueva?cliente=${c.id}`} className="flex min-h-[40px] shrink-0 items-center rounded-xl bg-acento px-3.5 text-[0.9rem] font-bold text-acento-texto">
                Vender
              </Link>
            </li>
          ))}
        </ul>
      )}
      {aVisitar.length > MAXIMO_LISTA && (
        <Link href="/clientes" className="text-[0.85rem] font-semibold text-acento">
          Ver los {aVisitar.length} ›
        </Link>
      )}
    </Tarjeta>
  );

  const separador = <div className="h-px bg-borde lg:hidden" />;
  const delMes = (
    <Tarjeta className="flex flex-col gap-3" aria-label={`Resumen de ${nombreMes}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[1.05rem] font-bold">{nombreMes}</h2>
        <Link href="/resumen" className="text-[0.82rem] font-semibold text-acento">
          Ver resumen completo ›
        </Link>
      </div>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[0.82rem] text-texto-suave">Vendido</span>
          <span className="num text-[1.35rem] font-bold" data-dato="vendido-mes" data-centavos={t.ventas.importe}>{formatearPesos(t.ventas.importe)}</span>
          <span className="text-[0.72rem] text-texto-suave">
            {t.ventas.ventas} venta{t.ventas.ventas === 1 ? "" : "s"} · {t.ventas.unidades} u
          </span>
        </div>
        {separador}
        <div className="flex flex-col gap-1">
          <span className="text-[0.82rem] text-texto-suave">Cobrado</span>
          <span className="num text-[1.35rem] font-bold" data-dato="cobrado-mes" data-centavos={t.cobrado.total}>{formatearPesos(t.cobrado.total)}</span>
          {t.cobrado.porSocio.size > 0 && (
            <span className="text-[0.72rem] text-texto-suave">
              {[...t.cobrado.porSocio.values()].map((s) => `${s.nombre} ${formatearPesos(s.total)}`).join(" · ")}
            </span>
          )}
        </div>
        {separador}
        <div className="flex flex-col gap-1">
          <span className="text-[0.82rem] text-texto-suave">Ganancia neta</span>
          <span className={`num text-[1.35rem] font-bold ${netaNegativa ? "text-peligro" : "text-acento"}`} data-dato="ganancia-neta-mes" data-centavos={t.ganancia.neta}>
            {formatearPesos(t.ganancia.neta)}
          </span>
          <span className="text-[0.72rem] text-texto-suave">
            {formatearPesos(t.ganancia.bruta)} de ventas − {formatearPesos(t.ganancia.perdidas)} de pérdidas
          </span>
        </div>
      </div>
      <AvisoInfo titulo="La ganancia no es plata disponible.">
        Parte todavía nos la deben y el costo de la mercadería es capital para reponer.
      </AvisoInfo>
    </Tarjeta>
  );

  const capital = (
    <Link href="/productos" aria-label="Capital en mercadería: ver stock">
      <Tarjeta className="flex items-center justify-between gap-3">
        <span className="font-bold">Capital en mercadería</span>
        <span className="flex flex-col items-end lg:flex-row lg:items-baseline lg:gap-2">
          <span className="num font-bold" data-dato="capital-usd" data-centavos={t.capital.stock_usd}>{formatearDolares(t.capital.stock_usd)}</span>
          <span className="num text-[0.82rem] text-texto-suave lg:text-base" data-dato="capital-ars" data-centavos={t.capital.stock_ars}>{formatearPesos(t.capital.stock_ars)}</span>
        </span>
      </Tarjeta>
    </Link>
  );

  const quienDebe = (
    <Tarjeta className="hidden flex-col gap-2 lg:flex" aria-label="Deudores">
      <h2 className="text-[1.05rem] font-bold">Deudores</h2>
      {deudores.length === 0 ? (
        <p className="text-texto-suave">Nadie debe nada.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {deudores.slice(0, MAXIMO_LISTA).map((d) => (
            <li key={d.cliente_id}>
              <Link href={`/clientes/${d.cliente_id}/cuenta`} className="flex items-center justify-between gap-3 py-2.5">
                <span>{d.nombre}</span>
                <span className="num font-bold text-peligro">{formatearPesos(d.saldo)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {deudores.length > MAXIMO_LISTA && (
        <Link href="/cobros" className="text-[0.85rem] font-semibold text-acento">
          Ver todos ({deudores.length}) ›
        </Link>
      )}
    </Tarjeta>
  );

  return (
    <main className="flex flex-1 flex-col leading-[1.2]">
      {/* Celular: franja de color con la marca y el saludo. */}
      <header className="flex flex-col gap-2 bg-cabecera px-[18px] pt-2.5 pb-11 text-cabecera-texto lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-extrabold">
            <Logo invertido />
            McStock
          </span>
          <span className="text-[0.82rem] opacity-85">{formatearDiaLargo(dia)}</span>
        </div>
        <h1 className="text-[1.4rem] font-bold">Hola, {socio.nombre}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:px-9 lg:py-7">
        {/* PC: saludo y buscador. */}
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <div className="flex flex-col">
            <span className="text-[0.82rem] text-texto-suave">{formatearDiaLargo(dia)}</span>
            <h1 className="text-[1.6rem] font-extrabold">Hola, {socio.nombre}</h1>
          </div>
          <form action="/buscar" className="flex min-h-[50px] w-[320px] items-center gap-2.5 rounded-[14px] border border-borde bg-superficie px-3.5 text-texto-suave">
            <Icono nombre="buscar" />
            <input name="q" type="search" aria-label="Buscar cliente o producto" placeholder="Buscar cliente o producto" className="min-w-0 flex-1 bg-transparent text-texto outline-none placeholder:text-texto-suave" />
          </form>
        </div>

        <div className="-mt-7 flex flex-col gap-3 px-4 lg:mt-0 lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-5 lg:px-0">
          {/* En el celular las dos columnas se "abren" (contents) y el orden lo dan las clases order-*. */}
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <div className="order-1 lg:order-none">{nosDeben}</div>
            <div className="order-3 lg:order-none">{delMes}</div>
            <div className="order-4 lg:order-none">{capital}</div>
          </div>
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <div className="order-2 lg:order-none">{visitar}</div>
            {quienDebe}
          </div>
        </div>
      </div>
    </main>
  );
}
