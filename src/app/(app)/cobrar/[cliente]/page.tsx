import { notFound } from "next/navigation";
import { obtenerCliente } from "@/datos/clientes";
import { cuentaDeCliente, saldoDeCliente, ultimoCobroDe } from "@/datos/cuentas";
import { formatearPesos, parsearImporte } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";
import { datosQuienDebe } from "../datos";
import { ListaQuienDebe } from "../ListaQuienDebe";
import { FormularioCobro } from "./FormularioCobro";

/** Cobro en una sola pantalla (maqueta 3). En PC, con la lista de quién debe a la izquierda. */
export default async function PaginaCobroCliente({ params, searchParams }: PageProps<"/cobrar/[cliente]">) {
  const { cliente: clienteId } = await params;
  const { importe, venta } = await searchParams;
  if (!esUuid(clienteId)) notFound();
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const supabase = await crearClienteSupabase();
  const [cliente, saldo, { cuenta }, ultimo, lista, socios] = await Promise.all([
    obtenerCliente(socio.negocioId, clienteId, dia),
    saldoDeCliente(socio.negocioId, clienteId),
    cuentaDeCliente(socio.negocioId, clienteId),
    ultimoCobroDe(socio.negocioId, socio.socioId),
    datosQuienDebe(socio.negocioId, dia),
    supabase.from("socios").select("id, nombre").eq("negocio_id", socio.negocioId).order("orden"),
  ]);
  if (!cliente) notFound();
  if (socios.error) throw new Error(`No se pudieron leer los socios: ${socios.error.message}`);

  const sugerido = typeof importe === "string" ? parsearImporte(importe) : null;
  const ventaId = typeof venta === "string" && esUuid(venta) ? venta : "";
  const pendientes = cuenta.deudas.filter((d) => d.saldo > 0);
  const soloVentas = pendientes.every((d) => d.tipo === "venta");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col leading-[1.2]">
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_1.25fr] lg:items-start lg:gap-5 lg:px-9 lg:pb-9">
        <h1 className="hidden text-[1.6rem] font-extrabold lg:col-span-2 lg:block lg:pt-7">Cobrar</h1>
        <div className="hidden lg:block">
          <ListaQuienDebe {...lista} seleccionado={clienteId} />
        </div>
        <FormularioCobro
          cliente={{ id: clienteId, nombre: cliente.nombre }}
          saldo={saldo}
          pendientes={pendientes.length === 0 ? "" : `${pendientes.length} ${soloVentas ? "venta" : "deuda"}${pendientes.length === 1 ? "" : "s"}`}
          importeInicial={sugerido?.ok && sugerido.centavos > 0 ? formatearPesos(sugerido.centavos).replace("$ ", "") : ""}
          socios={socios.data ?? []}
          socioActual={socio.socioId}
          ultimo={ultimo}
          hoy={dia}
          ventaId={ventaId}
        />
      </div>
    </main>
  );
}
