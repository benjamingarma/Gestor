/** Íconos propios de McStock (los mismos de las maquetas, docs/maquetas/pantallas.js). */
import type { SVGProps } from "react";

const TRAZOS = {
  inicio: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14.2c2.3.2 3.9 1.7 4.4 4.3" />
    </>
  ),
  vender: <path d="M12 5v14M5 12h14" />,
  cobrar: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.3" />
    </>
  ),
  mas: <path d="M5 7h14M5 12h14M5 17h9" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  flecha: <path d="m9 6 6 6-6 6" />,
  ok: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  stock: (
    <>
      <path d="M4 8 12 4l8 4v8l-8 4-8-4z" />
      <path d="m4 8 8 4 8-4M12 12v8" />
    </>
  ),
  grafico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  historial: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  caja: (
    <>
      <path d="M5 7h14l-1 12H6z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  roto: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="m9 9 3 3-2 2 3 3" />
    </>
  ),
  reparto: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v8l6 4" />
    </>
  ),
  salir: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
  repetir: (
    <>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = "h-6 w-6", ...props }: { nombre: NombreIcono } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

/** Logo "MS" de McStock. */
export function Logo({ invertido = false }: { invertido?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-7 place-items-center rounded-[9px] text-[0.8rem] font-black ${
        invertido ? "bg-cabecera-texto text-cabecera" : "bg-acento text-acento-texto"
      }`}
    >
      MS
    </span>
  );
}
