/** Traduce errores de la base a mensajes claros para los socios. */
export function mensajeDeError(error: { code?: string; message?: string } | null | undefined, porDefecto: string): string {
  if (!error) return porDefecto;
  const m = error.message ?? "";
  switch (error.code) {
    case "23505":
      if (m.includes("productos_unicos_idx")) return "Ya existe un producto con esa marca y modelo.";
      if (m.includes("identificador")) return "Esta operación ya se había guardado con otros datos. Recargá la pantalla.";
      return "Ese dato ya existe.";
    case "23514":
      return "Algún valor está fuera de los límites permitidos. Revisá los números.";
    case "42501":
      return "No tenés permiso para hacer esto.";
    case "22023":
      // Mensajes propios de nuestras funciones: ya están en español.
      return m || porDefecto;
    case "23503":
      return m.includes("inexistente") ? m : "El dato relacionado no existe.";
    default:
      return porDefecto;
  }
}
