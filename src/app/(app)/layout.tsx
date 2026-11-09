import { obtenerSocioActual } from "@/lib/sesion";

/** Pantallas para socios logueados. Muestra la franja de MODO PRUEBA mientras esté activo. */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const socio = await obtenerSocioActual();
  return (
    <>
      {socio.modoPrueba && (
        <div
          role="note"
          className="bg-amber-300 px-4 py-2 text-center text-sm font-bold text-black"
        >
          MODO PRUEBA · lo que cargues se marca como dato de prueba y se borra antes de usar la app en serio
        </div>
      )}
      {children}
    </>
  );
}
