import Link from "next/link";
import { notFound } from "next/navigation";
import { Confirmacion } from "@/componentes/Confirmacion";
import { Icono } from "@/componentes/Iconos";
import { NOMBRE_MEDIO, obtenerPago, saldoDeCliente } from "@/datos/cuentas";
import { formatearPesos } from "@/lib/dinero";
import { obtenerSocioActual } from "@/lib/sesion";
import { esUuid } from "@/lib/uuid";
import { DeshacerCobro } from "./Deshacer";

/** "Deshacer" solo se ofrece justo después de guardar (decisión de los socios, 10/11/2026; igual que la venta). */
const MINUTOS_PARA_DESHACER = 10;

/** Confirmación del cobro (maqueta 4): ✓, monto, a quién, cómo y cuánto le queda debiendo (de la base). */
export default async function PaginaCobroGuardado({ params, searchParams }: PageProps<"/cobros/[id]/guardado">) {
  const { id } = await params;
  const { venta } = await searchParams;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const pago = await obtenerPago(socio.negocioId, id);
  if (!pago) notFound();
  const saldo = await saldoDeCliente(socio.negocioId, pago.cliente_id);
  const anulado = pago.anulado_en !== null;
  // eslint-disable-next-line react-hooks/purity -- la página se arma en el servidor en cada pedido
  const reciente = Date.now() - new Date(pago.creado_en).getTime() < MINUTOS_PARA_DESHACER * 60_000;
  const listo = typeof venta === "string" && esUuid(venta) ? `/ventas/${venta}` : "/";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="flex items-center justify-between px-[18px] pt-2 pb-3">
        <span className="text-[1.25rem] font-extrabold">Cobrar</span>
        <Link href={listo} aria-label="Cerrar" className="grid h-11 w-11 place-items-center text-texto-suave">
          <Icono nombre="cerrar" />
        </Link>
      </header>
      <Confirmacion
        titulo={anulado ? "Cobro anulado" : "Cobro guardado"}
        monto={formatearPesos(pago.importe)}
        acciones={
          <>
            <Link href={listo} className="flex min-h-[56px] items-center justify-center rounded-2xl bg-acento text-[1.1rem] font-bold text-acento-texto">
              Listo
            </Link>
            {!anulado && reciente && <DeshacerCobro pagoId={pago.pago_id} clienteId={pago.cliente_id} />}
          </>
        }
      >
        {pago.cliente_nombre} · {NOMBRE_MEDIO[pago.medio]} · recibió {pago.recibido_por_nombre}
        <br />
        <span data-saldo-cliente={saldo}>
          {saldo > 0 ? (
            <>
              Le queda debiendo <b className="text-peligro">{formatearPesos(saldo)}</b>
            </>
          ) : saldo < 0 ? (
            <>
              Le queda <b className="text-acento">{formatearPesos(-saldo)}</b> a favor
            </>
          ) : (
            <>Quedó al día</>
          )}
        </span>
        {anulado && pago.motivo_anulacion && (
          <>
            <br />
            Motivo de la anulación: {pago.motivo_anulacion}
          </>
        )}
      </Confirmacion>
    </main>
  );
}
