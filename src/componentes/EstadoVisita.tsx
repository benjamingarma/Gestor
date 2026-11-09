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
      return "Toca visitar hoy";
    case "pronto":
      return `Visitar en ${dias(e.diasFaltan)} (${formatearDia(e.proxima).slice(0, 5)})`;
    case "al_dia":
      return `Próxima visita: ${formatearDia(e.proxima)}`;
  }
}

/** Etiqueta de color con el estado de visita del cliente. */
export function EtiquetaEstadoVisita({ estado }: { estado: Estado }) {
  const estilos = {
    atrasado: "bg-peligro text-white",
    hoy: "bg-amber-400 text-black",
    pronto: "border border-amber-500 text-amber-700 dark:text-amber-300",
    al_dia: "text-texto-suave",
    archivado: "border border-borde text-texto-suave",
  }[estado.tipo];
  return (
    <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-sm font-semibold ${estilos}`}>
      {textoEstadoVisita(estado)}
    </span>
  );
}
