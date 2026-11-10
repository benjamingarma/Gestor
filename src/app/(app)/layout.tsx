import { BarraInferior, BarraLateral } from "@/componentes/Navegacion";
import { obtenerSocioActual } from "@/lib/sesion";

/**
 * Pantallas para socios logueados: navegación (barra inferior en el celular, lateral en PC) y la franja
 * de MODO PRUEBA mientras esté activo.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const socio = await obtenerSocioActual();
  return (
    <div className="flex flex-1 lg:flex-row">
      <BarraLateral nombreSocio={socio.nombre} />
      <div className="flex min-w-0 flex-1 flex-col pb-[104px] lg:pb-0">
        {socio.modoPrueba && (
          <div role="note" className="bg-amber-300 px-4 py-2 text-center text-sm font-bold text-black">
            MODO PRUEBA · lo que cargues se marca como dato de prueba y se borra antes de usar la app en serio
          </div>
        )}
        {children}
      </div>
      <BarraInferior />
    </div>
  );
}
