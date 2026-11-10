import type { EstadoVisita as Estado } from "@/dominio/visitas";
import { formatearDia } from "@/lib/fechas";

function dias(n: number) {
  return n === 1 ? "1 día" : `${n} días`;
}

export function textoEstadoVisita(e: Estado): string {
  switch (e.tipo) {
    case "archivado":
      return "Archivado";
    case "atrasado":
      return `Atrasado ${dias(e.diasAtraso)}`;
    case "hoy":
      return "Le toca hoy"; // mismo texto que el Inicio (maqueta)
    case "pronto":
      return `Visitar en ${dias(e.diasFaltan)} (${formatearDia(e.proxima).slice(0, 5)})`;
    case "al_dia":
      return `Próxima visita: ${formatearDia(e.proxima)}`;
  }
}

/** Etiqueta de color con el estado de visita del cliente. */
export function EtiquetaEstadoVisita({ estado }: { estado: Estado }) {
  const estilos = {
    atrasado: "bg-peligro-suave text-peligro",
    hoy: "bg-aviso-suave text-aviso",
    pronto: "border border-aviso text-aviso",
    al_dia: "px-0 text-texto-suave",
    archivado: "bg-superficie-2 text-texto-suave",
  }[estado.tipo];
  return (
    <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap ${estilos}`}>
      {textoEstadoVisita(estado)}
    </span>
  );
}
