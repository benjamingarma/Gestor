import Link from "next/link";
import { cerrarSesion } from "@/app/acciones-sesion";
import { Boton } from "@/componentes/Boton";
import { BotonEnlace } from "@/componentes/BotonEnlace";
import { listarClientes } from "@/datos/clientes";
import { listarSaldos } from "@/datos/cuentas";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";

// Los módulos se habilitan uno por uno, a medida que se aprueban.
const MODULOS: { nombre: string; detalle: string; href?: string }[] = [
  { nombre: "Clientes", detalle: "Visitas, atrasados y datos de contacto", href: "/clientes" },
  { nombre: "Ventas", detalle: "Historial, detalle y anulaciones", href: "/ventas" },
  { nombre: "Stock y compras", detalle: "Productos, compras en dólares y stock", href: "/productos" },
  { nombre: "Cobros", detalle: "Quién debe plata y últimos cobros", href: "/cobros" },
  { nombre: "Resumen y ganancia", detalle: "Ganancia, reparto, cobrado, capital", href: "/resumen" },
];

export default async function PaginaInicio() {
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const [clientes, saldos] = await Promise.all([listarClientes(socio.negocioId, dia), listarSaldos(socio.negocioId)]);
  const nosDeben = saldos.filter((s) => s.saldo > 0).reduce((t, s) => t + s.saldo, 0);
  const atrasados = clientes.filter((c) => c.estado.tipo === "atrasado").length;
  const paraHoy = clientes.filter((c) => c.estado.tipo === "hoy").length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-texto-suave">
          {socio.negocioNombre} · {formatearDia(dia)}
        </p>
        <h1 className="text-2xl font-bold">Hola, {socio.nombre}</h1>
      </header>

      {(atrasados > 0 || paraHoy > 0) && (
        <Link
          href="/clientes"
          className="flex min-h-[64px] flex-col justify-center rounded-xl border-2 border-peligro bg-superficie px-5 py-3"
        >
          <span className="text-lg font-bold">A visitar</span>
          <span className="text-base">
            {atrasados > 0 && <strong className="text-peligro">{atrasados} atrasado{atrasados === 1 ? "" : "s"}</strong>}
            {atrasados > 0 && paraHoy > 0 && " · "}
            {paraHoy > 0 && <strong>{paraHoy} para hoy</strong>}
          </span>
        </Link>
      )}

      <BotonEnlace href="/ventas/nueva" className="min-h-[64px] text-xl">
        + Nueva venta
      </BotonEnlace>

      {nosDeben > 0 && (
        <Link href="/cobros" className="flex min-h-[56px] items-center justify-between rounded-xl border border-borde bg-superficie px-5 py-3">
          <span className="text-lg font-semibold">Nos deben</span>
          <span className="text-xl font-bold text-peligro">{formatearPesos(nosDeben)}</span>
        </Link>
      )}

      <section aria-label="Módulos" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODULOS.map((m) =>
          m.href ? (
            <Link
              key={m.nombre}
              href={m.href}
              className="flex min-h-[72px] flex-col justify-center rounded-xl border border-borde bg-superficie px-5 py-3 hover:border-acento"
            >
              <span className="text-lg font-semibold">{m.nombre}</span>
              <span className="text-sm text-texto-suave">{m.detalle}</span>
            </Link>
          ) : (
            <div
              key={m.nombre}
              aria-disabled="true"
              className="flex min-h-[72px] flex-col justify-center rounded-xl border border-dashed border-borde bg-superficie px-5 py-3 opacity-70"
            >
              <span className="text-lg font-semibold">{m.nombre}</span>
              <span className="text-sm text-texto-suave">{m.detalle}</span>
            </div>
          ),
        )}
      </section>

      <footer className="mt-auto flex flex-col gap-2 pt-6">
        <p className="text-center text-sm text-texto-suave">Sesión iniciada como {socio.email}</p>
        <form action={cerrarSesion}>
          <Boton variante="secundario" type="submit">
            Cerrar sesión
          </Boton>
        </form>
      </footer>
    </main>
  );
}
