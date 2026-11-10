/** Texto sin tildes y en minúsculas, para buscar ("José" encuentra "jose"). */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** ¿Todas las palabras buscadas aparecen en el texto? (sin importar tildes, mayúsculas ni orden) */
export function coincide(texto: string, busqueda: string): boolean {
  const t = normalizar(texto);
  return normalizar(busqueda).split(/\s+/).filter(Boolean).every((p) => t.includes(p));
}
