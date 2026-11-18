import type { ReactNode } from "react";

/**
 * Pantallas de carga ("esqueletos"): se muestran al instante al navegar, mientras el servidor lee los datos de la
 * pantalla nueva. No muestran ningún número: los datos siguen saliendo de la base en el momento.
 */
function Bloque({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-[10px] bg-superficie-2 motion-reduce:animate-none ${className}`} />;
}

function TarjetaVacia({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 rounded-[20px] border border-borde bg-superficie p-4 shadow-tarjeta ${className}`}>{children}</div>;
}

function Contenedor({ children, ancho = "max-w-2xl" }: { children: ReactNode; ancho?: string }) {
  return (
    <main role="status" aria-busy="true" className={`mx-auto flex w-full ${ancho} flex-1 flex-col gap-4 px-4 py-6 lg:py-7`}>
      <span className="sr-only">Cargando…</span>
      {children}
    </main>
  );
}

const Titulo = () => <Bloque className="h-8 w-44" />;

function Filas({ cantidad }: { cantidad: number }) {
  return (
    <TarjetaVacia className="gap-0 py-1">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-borde py-3 last:border-b-0">
          <Bloque className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Bloque className="h-4 w-2/5" />
            <Bloque className="h-3 w-3/5" />
          </div>
          <Bloque className="h-5 w-16" />
        </div>
      ))}
    </TarjetaVacia>
  );
}

/** Listas: Clientes, Deudores, Pagos recibidos, Ventas, Stock, Compras, Ajustes. */
export function EsqueletoLista() {
  return (
    <Contenedor>
      <Titulo />
      <Bloque className="h-[50px] w-full rounded-[14px]" />
      <Filas cantidad={7} />
    </Contenedor>
  );
}

/** Resumen: pestañas, selector de período y tarjetas de totales. */
export function EsqueletoResumen() {
  return (
    <Contenedor>
      <Titulo />
      <Bloque className="h-[52px] w-full rounded-[14px]" />
      <Bloque className="h-[50px] w-full rounded-[14px]" />
      {[5, 3, 3].map((lineas, i) => (
        <TarjetaVacia key={i}>
          <Bloque className="h-5 w-1/2" />
          {Array.from({ length: lineas }, (_, j) => (
            <div key={j} className="flex justify-between gap-3">
              <Bloque className="h-4 w-2/5" />
              <Bloque className="h-4 w-20" />
            </div>
          ))}
        </TarjetaVacia>
      ))}
    </Contenedor>
  );
}

/** Inicio: "Nos deben", "A visitar hoy" y la tarjeta de la semana. */
export function EsqueletoInicio() {
  return (
    <Contenedor ancho="max-w-6xl">
      <Bloque className="h-7 w-40" />
      <Bloque className="h-9 w-56" />
      <TarjetaVacia>
        <Bloque className="h-4 w-24" />
        <div className="flex items-center justify-between gap-3">
          <Bloque className="h-10 w-48" />
          <Bloque className="h-10 w-32 rounded-xl" />
        </div>
        <Bloque className="h-4 w-3/4" />
      </TarjetaVacia>
      <Filas cantidad={3} />
      <TarjetaVacia>
        <div className="flex items-center justify-between">
          <Bloque className="h-6 w-32" />
          <Bloque className="h-9 w-36 rounded-[12px]" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bloque className="h-4 w-20" />
            <Bloque className="h-7 w-36" />
          </div>
        ))}
      </TarjetaVacia>
    </Contenedor>
  );
}

/** Fichas, detalles y formularios. */
export function EsqueletoGenerico() {
  return (
    <Contenedor ancho="max-w-xl">
      <Bloque className="h-5 w-20" />
      <Titulo />
      <TarjetaVacia>
        <Bloque className="h-5 w-1/2" />
        <Bloque className="h-4 w-3/4" />
        <Bloque className="h-4 w-2/3" />
      </TarjetaVacia>
      <TarjetaVacia>
        <Bloque className="h-[50px] w-full rounded-[14px]" />
        <Bloque className="h-[50px] w-full rounded-[14px]" />
        <Bloque className="h-[56px] w-full rounded-2xl" />
      </TarjetaVacia>
    </Contenedor>
  );
}
