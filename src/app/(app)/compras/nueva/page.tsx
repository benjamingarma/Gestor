import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { listarProductosActivos, ultimoTipoDeCambio } from "@/datos/inventario";
import { formatearTipoDeCambio } from "@/lib/dinero";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { FormularioCompra } from "./FormularioCompra";

export default async function PaginaNuevaCompra({ searchParams }: PageProps<"/compras/nueva">) {
  const { producto } = await searchParams;
  const socio = await obtenerSocioActual();
  const [productos, ultimoTc] = await Promise.all([
    listarProductosActivos(socio.negocioId),
    ultimoTipoDeCambio(socio.negocioId),
  ]);

  if (productos.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
        <Encabezado titulo="Cargar compra" volverA="/productos" />
        <p>Primero creá el producto que compraste.</p>
        <BotonEnlace href="/productos/nuevo">+ Nuevo producto</BotonEnlace>
      </main>
    );
  }

  const productoInicial =
    typeof producto === "string" && productos.some((p) => p.id === producto) ? producto : "";
  const sugerido = ultimoTc ? formatearTipoDeCambio(ultimoTc.tipoDeCambio).replace("$ ", "") : "";
  const ayuda = ultimoTc
    ? `Sugerido: el último que usaste (${formatearTipoDeCambio(ultimoTc.tipoDeCambio)}, compra del ${formatearDia(ultimoTc.fecha)}). Cambialo si el blue de ese día era otro.`
    : "El dólar blue del día de la compra.";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Encabezado titulo="Cargar compra" volverA={productoInicial ? `/productos/${productoInicial}` : "/productos"} />
      <FormularioCompra
        productos={productos.map((p) => ({ id: p.id, nombre: `${p.marca} ${p.modelo}` }))}
        productoInicial={productoInicial}
        hoy={hoy()}
        tipoDeCambioSugerido={sugerido}
        ayudaTipoDeCambio={ayuda}
      />
    </main>
  );
}
