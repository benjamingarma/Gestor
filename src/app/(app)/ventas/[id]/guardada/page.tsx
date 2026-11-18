import Link from "next/link";
import { notFound } from "next/navigation";
import { Confirmacion } from "@/componentes/Confirmacion";
import { Icono } from "@/componentes/Iconos";
import { cuentaDeCliente } from "@/datos/cuentas";
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
  // Lo guardado, con la misma imputación de siempre (el pago de la venta, primero a esa venta).
  const { cuenta, pagos } = await cuentaDeCliente(socio.negocioId, venta.cliente_id);
  const saldo = cuenta.saldo;
  const pagosDeVenta = pagos.filter((p) => p.venta_id === venta.venta_id && p.anulado_en === null);
  const cobrado = pagosDeVenta.reduce((s, p) => s + p.importe, 0);
  const estaVenta = cuenta.deudas.find((d) => d.id === venta.venta_id);
  // Deuda de antes = lo que debe sin contar lo que queda de esta venta (decisión del 18/11/2026: va aparte).
  const deudaAnterior = Math.max(0, cuenta.debe - (estaVenta?.saldo ?? 0));
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
            {!anulada && reciente && <DeshacerVenta ventaId={venta.venta_id} cobrado={cobrado} />}
          </>
        }
      >
        {venta.cliente_nombre} · {productos} producto{productos === 1 ? "" : "s"} ({venta.unidades} u) · vendió {venta.vendido_por_nombre}
        <br />
        {anulada ? (
          saldo > 0 ? (
            <>
              Debe <b className="text-peligro">{formatearPesos(saldo)}</b>
            </>
          ) : saldo < 0 ? (
            <>Le queda {formatearPesos(-saldo)} a favor</>
          ) : (
            <>No debe nada</>
          )
        ) : (
          <span data-cobrado={cobrado} data-venta-debe={estaVenta?.saldo ?? 0} data-deuda-anterior={deudaAnterior}>
            Cobrado <b>{formatearPesos(cobrado)}</b> · Esta venta:{" "}
            {estaVenta && estaVenta.saldo > 0 ? <b className="text-peligro">debe {formatearPesos(estaVenta.saldo)}</b> : <b className="text-acento">pagada</b>}
            {deudaAnterior > 0 && (
              <>
                <br />
                Deuda anterior <b className="text-peligro">{formatearPesos(deudaAnterior)}</b>
              </>
            )}
            {saldo < 0 && (
              <>
                <br />
                Le queda {formatearPesos(-saldo)} a favor
              </>
            )}
          </span>
        )}
      </Confirmacion>
    </main>
  );
}
