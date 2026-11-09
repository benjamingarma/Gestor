import { notFound } from "next/navigation";
import { Encabezado } from "@/componentes/Encabezado";
import { obtenerCliente } from "@/datos/clientes";
import { saldoDeCliente } from "@/datos/cuentas";
import { formatearPesos, parsearImporte } from "@/lib/dinero";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";
import { FormularioCobro } from "./FormularioCobro";

export default async function PaginaCobrar({ params, searchParams }: PageProps<"/clientes/[id]/cobrar">) {
  const { id } = await params;
  const { importe, venta } = await searchParams;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const [cliente, saldo] = await Promise.all([obtenerCliente(socio.negocioId, id, dia), saldoDeCliente(socio.negocioId, id)]);
  if (!cliente) notFound();
  const supabase = await crearClienteSupabase();
  const { data: socios } = await supabase.from("socios").select("id, nombre").eq("negocio_id", socio.negocioId).order("orden");

  const sugerido = typeof importe === "string" ? parsearImporte(importe) : null;
  const ventaId = typeof venta === "string" && esUuid(venta) ? venta : "";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado
        titulo={`Cobrar a ${cliente.nombre}`}
        volverA={ventaId ? `/ventas/${ventaId}` : `/clientes/${id}`}
        subtitulo={saldo > 0 ? `Debe ${formatearPesos(saldo)}` : saldo < 0 ? `Tiene ${formatearPesos(-saldo)} a favor` : "Está al día"}
      />
      <FormularioCobro
        clienteId={id}
        saldo={saldo}
        importeInicial={sugerido?.ok ? formatearPesos(sugerido.centavos).replace("$ ", "") : ""}
        socios={socios ?? []}
        socioActual={socio.socioId}
        hoy={dia}
        volverA={ventaId}
      />
    </main>
  );
}
