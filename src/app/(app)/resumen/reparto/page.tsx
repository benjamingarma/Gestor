import { Aviso } from "@/componentes/Aviso";
import { Encabezado } from "@/componentes/Encabezado";
import { leerSociosYReparto } from "@/datos/resumen";
import { vigenteEn } from "@/dominio/ganancia";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { FormularioReparto } from "./FormularioReparto";

const pct = (c: number) => `${(c / 100).toLocaleString("es-AR")} %`;

export default async function PaginaReparto({ searchParams }: PageProps<"/resumen/reparto">) {
  const { ok } = await searchParams;
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const { socios, vigencias } = await leerSociosYReparto(socio.negocioId);
  const actual = vigenteEn(vigencias, dia, socios);
  const nombre = new Map(socios.map((s) => [s.id, s.nombre]));
  const futuras = vigencias.filter((v) => v.desde > dia);
  const historial = [...vigencias].filter((v) => v.desde <= dia).reverse();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado titulo="Reparto de la ganancia" volverA="/resumen" />
      {ok && <Aviso tipo="ok">Reparto guardado.</Aviso>}

      <section className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-4">
        <span className="text-texto-suave">Hoy rige{vigencias.length === 0 ? " (por defecto, partes iguales)" : ""}</span>
        {actual.map((p) => (
          <div key={p.socioId} className="flex justify-between text-xl font-bold">
            <span>{nombre.get(p.socioId)}</span>
            <span>{pct(p.centesimos)}</span>
          </div>
        ))}
        <p className="mt-1 text-xs text-texto-suave">
          Se reparte la ganancia neta (ventas − costo − pérdidas). El capital y el dinero cobrado no se reparten.
        </p>
      </section>

      {futuras.map((v) => (
        <p key={v.desde} className="rounded-lg border border-amber-500 px-4 py-3">
          Programado desde el {formatearDia(v.desde)}: {v.porcentajes.map((p) => `${nombre.get(p.socioId)} ${pct(p.centesimos)}`).join(" · ")}
        </p>
      ))}

      <section className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
        <h2 className="text-lg font-bold">Cambiar el reparto</h2>
        <FormularioReparto socios={socios.map((s) => ({ id: s.id, nombre: s.nombre, actual: actual.find((p) => p.socioId === s.id)?.centesimos ?? 0 }))} hoy={dia} />
      </section>

      {historial.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">Historial</h2>
          {historial.map((v) => (
            <p key={v.desde} className="text-base">
              Desde el {formatearDia(v.desde)}: {v.porcentajes.map((p) => `${nombre.get(p.socioId)} ${pct(p.centesimos)}`).join(" · ")}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
