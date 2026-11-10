import Link from "next/link";
import { Encabezado } from "@/componentes/Encabezado";
import { Icono } from "@/componentes/Iconos";
import { Avatar, Tarjeta } from "@/componentes/UI";
import { listarClientes } from "@/datos/clientes";
import { listarStockProductos } from "@/datos/inventario";
import { coincide } from "@/lib/texto";
import { formatearPesos } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";

/** Buscador del Inicio en PC: clientes y productos que coinciden con lo escrito. */
export default async function PaginaBuscar({ searchParams }: PageProps<"/buscar">) {
  const { q } = await searchParams;
  const texto = typeof q === "string" ? q.trim().slice(0, 60) : "";
  const socio = await obtenerSocioActual();
  const [clientes, productos] = texto
    ? await Promise.all([listarClientes(socio.negocioId, hoy()), listarStockProductos(socio.negocioId)])
    : [[], []];
  const cs = clientes.filter((c) => coincide(c.nombre, texto)).slice(0, 30);
  const ps = productos.filter((p) => coincide(`${p.marca} ${p.modelo}`, texto)).slice(0, 30);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <Encabezado titulo="Buscar" volverA="/" />
      <form action="/buscar" className="flex min-h-[50px] items-center gap-2.5 rounded-[14px] border border-borde bg-superficie px-3.5 text-texto-suave">
        <Icono nombre="buscar" />
        <input name="q" type="search" defaultValue={texto} aria-label="Buscar cliente o producto" placeholder="Buscar cliente o producto" className="min-w-0 flex-1 bg-transparent text-lg text-texto outline-none" />
      </form>
      {texto && cs.length === 0 && ps.length === 0 && <p className="text-texto-suave">No hay clientes ni productos que coincidan con “{texto}”.</p>}
      {cs.length > 0 && (
        <Tarjeta className="flex flex-col gap-1">
          <h2 className="text-[1.05rem] font-bold">Clientes</h2>
          <ul className="flex flex-col divide-y divide-borde">
            {cs.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 py-2.5">
                  <Avatar nombre={c.nombre} />
                  <span className="font-semibold">{c.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {ps.length > 0 && (
        <Tarjeta className="flex flex-col gap-1">
          <h2 className="text-[1.05rem] font-bold">Productos</h2>
          <ul className="flex flex-col divide-y divide-borde">
            {ps.map((p) => (
              <li key={p.producto_id}>
                <Link href={`/productos/${p.producto_id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex flex-col">
                    <span className="font-semibold">{p.marca} {p.modelo}</span>
                    <span className="text-[0.82rem] text-texto-suave">Quedan {p.unidades}</span>
                  </span>
                  <span className="num font-semibold">{p.precio_general !== null ? formatearPesos(p.precio_general) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </main>
  );
}
