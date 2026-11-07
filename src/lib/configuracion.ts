import "server-only";

/**
 * Variables de entorno. Se leen SOLO en el servidor: ni la URL ni la clave de Supabase
 * llegan al navegador (no usan el prefijo NEXT_PUBLIC_).
 * Valores locales: .env.local (ignorado por git). Producción/prueba: panel de Netlify.
 */
export function configuracionSupabase(): { url: string; clavePublica: string } {
  const url = process.env.SUPABASE_URL;
  const clavePublica = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clavePublica) {
    throw new Error(
      "Faltan SUPABASE_URL y/o SUPABASE_PUBLISHABLE_KEY. Copiá .env.example a .env.local y completalas.",
    );
  }
  return { url, clavePublica };
}
