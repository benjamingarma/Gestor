import { describe, expect, it } from "vitest";
import { enPeriodo, totalesCobros, totalesVentas } from "./resumen";

describe("resumen de un período", () => {
  it("enPeriodo", () => {
    expect(enPeriodo("2026-10-31", "2026-10")).toBe(true);
    expect(enPeriodo("2026-11-01", "2026-10")).toBe(false);
    expect(enPeriodo("2020-01-01", "todo")).toBe(true);
    expect(enPeriodo("2026-01-05", "2026-1")).toBe(false);
  });
  it("totales de ventas (octubre del plan)", () => {
    const filas = [
      { dia: "2026-10-05", ventas: 1, unidades: 12, importe: 12_000_000, costo_ars: 7_400_000, costo_usd: 6_000, ganancia: 4_600_000 },
      { dia: "2026-10-06", ventas: 1, unidades: 5, importe: 4_750_000, costo_ars: 3_000_000, costo_usd: 2_100, ganancia: 1_750_000 },
      { dia: "2026-10-20", ventas: 1, unidades: 3, importe: 3_150_000, costo_ars: 2_100_000, costo_usd: 1_500, ganancia: 1_050_000 },
    ];
    expect(totalesVentas(filas)).toEqual({ ventas: 3, unidades: 20, importe: 19_900_000, costoArs: 12_500_000, costoUsd: 9_600, ganancia: 7_400_000 });
    const t = totalesVentas(filas);
    expect(t.importe).toBe(t.costoArs + t.ganancia); // I5
  });
  it("totales de cobros por medio y por socio que recibió (plan 6.7: $160.000)", () => {
    const t = totalesCobros([
      { dia: "2026-10-10", medio: "transferencia", recibido_por: "b", recibido_por_nombre: "Benjamín", cobros: 1, total: 6_000_000 },
      { dia: "2026-10-25", medio: "efectivo", recibido_por: "p", recibido_por_nombre: "Papá", cobros: 1, total: 5_000_000 },
      { dia: "2026-10-30", medio: "mercado_pago", recibido_por: "b", recibido_por_nombre: "Benjamín", cobros: 1, total: 5_000_000 },
    ]);
    expect(t.total).toBe(16_000_000);
    expect(t.cobros).toBe(3);
    expect(Object.fromEntries(t.porMedio)).toEqual({ transferencia: 6_000_000, efectivo: 5_000_000, mercado_pago: 5_000_000 });
    expect(Object.fromEntries(t.porSocio)).toEqual({ b: { nombre: "Benjamín", total: 11_000_000 }, p: { nombre: "Papá", total: 5_000_000 } });
  });
});
