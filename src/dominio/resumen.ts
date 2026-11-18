/** Totales de un período a partir de filas diarias (ventas y cobros). */
import type { Centavos } from "@/lib/dinero";
import { enSemana, esPeriodoSemana, PREFIJO_SEMANA } from "@/lib/semanas";

export type FilaGanancia = { dia: string; ventas: number; unidades: number; importe: Centavos; costo_ars: Centavos; costo_usd: Centavos; ganancia: Centavos };
export type FilaCobro = { dia: string; medio: string; recibido_por: string; recibido_por_nombre: string; cobros: number; total: Centavos };

/** ¿El día cae en el período? período = "AAAA-MM", "sem-AAAA-MM-DD" (semana que empieza ese domingo) o "todo". */
export function enPeriodo(dia: string, periodo: string): boolean {
  if (periodo === "todo") return true;
  if (esPeriodoSemana(periodo)) return enSemana(dia, periodo.slice(PREFIJO_SEMANA.length));
  return dia.startsWith(`${periodo}-`);
}

export function totalesVentas(filas: FilaGanancia[]) {
  return filas.reduce(
    (t, f) => ({
      ventas: t.ventas + f.ventas,
      unidades: t.unidades + f.unidades,
      importe: t.importe + f.importe,
      costoArs: t.costoArs + f.costo_ars,
      costoUsd: t.costoUsd + f.costo_usd,
      ganancia: t.ganancia + f.ganancia,
    }),
    { ventas: 0, unidades: 0, importe: 0, costoArs: 0, costoUsd: 0, ganancia: 0 },
  );
}

export function totalesCobros(filas: FilaCobro[]) {
  const porMedio = new Map<string, number>();
  const porSocio = new Map<string, { nombre: string; total: number }>();
  let total = 0;
  let cobros = 0;
  for (const f of filas) {
    total += f.total;
    cobros += f.cobros;
    porMedio.set(f.medio, (porMedio.get(f.medio) ?? 0) + f.total);
    const s = porSocio.get(f.recibido_por) ?? { nombre: f.recibido_por_nombre, total: 0 };
    s.total += f.total;
    porSocio.set(f.recibido_por, s);
  }
  return { total, cobros, porMedio, porSocio };
}
