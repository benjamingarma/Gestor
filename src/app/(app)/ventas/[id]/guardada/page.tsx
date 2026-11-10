import Link from "next/link";
import { notFound } from "next/navigation";
import { Confirmacion } from "@/componentes/Confirmacion";
import { Icono } from "@/componentes/Iconos";
import { saldoDeCliente } from "@/datos/cuentas";
import { obtenerVenta } from "@/datos/ventas";
import { formatearPesos } from "@/lib/dinero";
import { obtenerSocioActual } from "@/lib/sesion";
import { esUuid } from "@/lib/uuid";
import { DeshacerVenta } from "./Deshacer";

/** "Deshacer" solo se ofrece justo después de guardar (decisión de los socios, 10/11/2026). */
const MINUTOS_PARA_DESHACER = 10;

export default async function PaginaVentaGuardada({ params }: PageProps<"/ventas/[id]/guardada">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const venta = await obtenerVenta(socio.negocioId, id);
  if (!venta) notFound();
  const saldo = await saldoDeCliente(socio.negocioId, venta.cliente_id);
  const anulada = venta.anulado_en !== null;
  // eslint-disable-next-line react-hooks/purity -- la página se arma en el servidor en cada pedido
  const reciente = Date.now() - new Date(venta.creado_en).getTime() < MINUTOS_PARA_DESHACER * 60_000;
  const productos = venta.renglones.length;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="flex items-center justify-between px-[18px] pt-2 pb-3">
        <span className="text-[1.25rem] font-extrabold">Nueva venta</span>
        <Link href="/" aria-label="Cerrar" className="grid h-11 w-11 place-items-center text-texto-suave">
          <Icono nombre="cerrar" />
        </Link>
      </header>
      <Confirmacion
        titulo={anulada ? "Venta anulada" : "Venta guardada"}
        monto={formatearPesos(venta.importe)}
        acciones={
          <>
            <Link href="/" className="flex min-h-[56px] items-center justify-center rounded-2xl bg-acento text-[1.1rem] font-bold text-acento-texto">
              Listo
            </Link>
            {!anulada && reciente && <DeshacerVenta ventaId={venta.venta_id} />}
          </>
        }
      >
        {venta.cliente_nombre} · {productos} producto{productos === 1 ? "" : "s"} ({venta.unidades} u) · vendió {venta.vendido_por_nombre}
        <br />
        {saldo > 0 ? (
          <>
            Ahora debe <b className="text-peligro">{formatearPesos(saldo)}</b>
          </>
        ) : saldo < 0 ? (
          <>Le queda {formatearPesos(-saldo)} a favor</>
        ) : (
          <>No debe nada</>
        )}
      </Confirmacion>
    </main>
  );
}
