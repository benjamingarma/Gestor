import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { aplicarCreditos, diaDeudaMasVieja } from "./cuentaCorriente";
import { armarTablero, type DatosTablero } from "./tablero";

// Escenario del plan (secciones 6 y 7), con la rotura A1 del módulo 1.6.
const PLAN: DatosTablero = {
  ganancias: [
    { dia: "2026-10-05", ventas: 1, unidades: 12, importe: 12_000_000, costo_ars: 7_400_000, costo_usd: 6_000, ganancia: 4_600_000 },
    { dia: "2026-10-06", ventas: 1, unidades: 5, importe: 4_750_000, costo_ars: 3_000_000, costo_usd: 2_100, ganancia: 1_750_000 },
    { dia: "2026-10-20", ventas: 1, unidades: 3, importe: 3_150_000, costo_ars: 2_100_000, costo_usd: 1_500, ganancia: 1_050_000 },
  ],
  perdidas: [{ dia: "2026-10-28", ajustes: 1, unidades: 1, costo_ars: 700_000, costo_usd: 500 }],
  cobros: [
    { dia: "2026-10-10", medio: "transferencia", recibido_por: "b", recibido_por_nombre: "Benjamín", cobros: 1, total: 6_000_000 },
    { dia: "2026-10-25", medio: "efectivo", recibido_por: "p", recibido_por_nombre: "Papá", cobros: 1, total: 5_000_000 },
    { dia: "2026-10-30", medio: "mercado_pago", recibido_por: "b", recibido_por_nombre: "Benjamín", cobros: 1, total: 5_000_000 },
  ],
  saldos: [
    { cliente_id: "ana", nombre: "Ana", saldo: 6_000_000 },
    { cliente_id: "bruno", nombre: "Bruno", saldo: -100_000 },
  ],
  capital: {
    invertido_usd: 19_500, invertido_ars: 26_750_000,
    vendido_usd: 9_600, vendido_ars: 12_500_000,
    perdidas_usd: 500, perdidas_ars: 700_000,
    stock_usd: 9_400, stock_ars: 13_550_000,
  },
  socios: [{ id: "b", nombre: "Benjamín", orden: 1 }, { id: "p", nombre: "Papá", orden: 2 }],
  vigencias: [],
  // Las mismas ventas y cobros, uno por uno: Ana (V1) y Bruno (saldo del papel $ 20.000, V2 y V3).
  movimientos: {
    ventas: [
      { id: "V1", clienteId: "ana", dia: "2026-10-05", orden: 1, importe: 12_000_000, ganancia: 4_600_000 },
      { id: "V2", clienteId: "bruno", dia: "2026-10-06", orden: 2, importe: 4_750_000, ganancia: 1_750_000 },
      { id: "V3", clienteId: "bruno", dia: "2026-10-20", orden: 3, importe: 3_150_000, ganancia: 1_050_000 },
    ],
    saldos: [{ id: "SI", clienteId: "bruno", tipo: "deuda", dia: "2026-09-01", orden: 1, importe: 2_000_000 }],
    pagos: [
      { id: "P1", clienteId: "ana", dia: "2026-10-10", importe: 6_000_000, ventaId: null },
      { id: "P2", clienteId: "bruno", dia: "2026-10-25", importe: 5_000_000, ventaId: null },
      { id: "P3", clienteId: "bruno", dia: "2026-10-30", importe: 5_000_000, ventaId: null },
    ],
  },
};

describe("armarTablero (los mismos totales para Inicio, Cobrar y Resumen)", () => {
  it("octubre del plan: vendido, ganancia neta, cobrado, deudas, saldos a favor y capital", () => {
    const t = armarTablero(PLAN, "2026-10");
    expect(t.ventas).toMatchObject({ ventas: 3, unidades: 20, importe: 19_900_000, costoArs: 12_500_000, ganancia: 7_400_000 });
    // Según lo cobrado: Ana pagó la mitad ($ 23.000); Bruno pagó el papel ($ 10.000 estimado, 50 %), V2 y V3 enteras ($ 28.000).
    expect(t.ganancia).toMatchObject({ bruta: 6_100_000, perdidas: 700_000, neta: 5_400_000 });
    expect(t.ganancia.partes.map((p) => p.importe)).toEqual([2_700_000, 2_700_000]);
    expect(t.desglose).toMatchObject({ cobrado: 16_000_000, aPapel: 2_000_000, quedoAFavor: 100_000, aFavorUsado: 0, costoCobrado: 9_800_000, ganancia: 6_100_000 });
    expect(t.gananciaPendiente).toBe(2_300_000);
    expect(t.perdidas).toEqual({ ajustes: 1, unidades: 1, costoArs: 700_000, costoUsd: 500 });
    expect(t.cobrado.total).toBe(16_000_000);
    expect([...t.cobrado.porSocio.values()]).toEqual([{ nombre: "Benjamín", total: 11_000_000 }, { nombre: "Papá", total: 5_000_000 }]);
    expect(t.nosDeben).toEqual({ total: 6_000_000, clientes: 1 });
    expect(t.aFavor).toEqual({ total: 100_000, clientes: 1 });
    expect(t.capitalCierra).toBe(true);
  });

  it("la ganancia no se mezcla con lo cobrado ni con el capital", () => {
    const t = armarTablero(PLAN, "2026-10");
    expect(t.ganancia.neta).not.toBe(t.cobrado.total);
    const d = t.desglose;
    expect(d.cobrado).toBe(t.cobrado.total);
    expect(d.cobrado - d.quedoAFavor + d.aFavorUsado - d.costoCobrado - t.ganancia.perdidas).toBe(t.ganancia.neta);
  });

  it("un mes sin movimientos da cero, pero deudas, saldos a favor y capital son de hoy (no dependen del mes)", () => {
    const t = armarTablero(PLAN, "2026-11");
    expect(t.ventas.importe).toBe(0);
    expect(t.cobrado.total).toBe(0);
    expect(t.ganancia.neta).toBe(0);
    expect(t.nosDeben.total).toBe(6_000_000);
    expect(t.capital.stock_ars).toBe(13_550_000);
    expect(t.acumulada.neta).toBe(5_400_000);
    expect(t.gananciaPendiente).toBe(2_300_000);
  });

  it("si el capital no cierra por un centavo, se avisa", () => {
    expect(armarTablero({ ...PLAN, capital: { ...PLAN.capital, stock_ars: 13_550_001 } }, "todo").capitalCierra).toBe(false);
    expect(armarTablero({ ...PLAN, capital: { ...PLAN.capital, stock_usd: 9_399 } }, "todo").capitalCierra).toBe(false);
  });

  it("propiedad: la suma de los meses da lo mismo que todo el historial (vendido, cobrado, pérdidas y ganancia neta)", () => {
    const dia = fc.constantFrom("2026-09-03", "2026-10-01", "2026-10-31", "2026-11-15", "2026-12-24");
    fc.assert(
      fc.property(
        fc.array(fc.record({ dia, importe: fc.integer({ min: 0, max: 50_000_000 }), ganancia: fc.integer({ min: -5_000_000, max: 20_000_000 }) }), { maxLength: 15 }),
        fc.array(fc.record({ dia, costo: fc.integer({ min: 0, max: 5_000_000 }) }), { maxLength: 5 }),
        fc.array(fc.record({ dia, total: fc.integer({ min: 1, max: 30_000_000 }) }), { maxLength: 10 }),
        (vs, ps, cs) => {
          const datos: DatosTablero = {
            ...PLAN,
            ganancias: vs.map((v) => ({ dia: v.dia, ventas: 1, unidades: 1, importe: v.importe, costo_ars: v.importe - v.ganancia, costo_usd: 0, ganancia: v.ganancia })),
            perdidas: ps.map((p) => ({ dia: p.dia, ajustes: 1, unidades: 1, costo_ars: p.costo, costo_usd: 0 })),
            cobros: cs.map((c) => ({ dia: c.dia, medio: "efectivo", recibido_por: "b", recibido_por_nombre: "Benjamín", cobros: 1, total: c.total })),
            movimientos: {
              ventas: vs.map((v, i) => ({ id: `v${i}`, clienteId: `c${i % 2}`, dia: v.dia, orden: i, importe: v.importe, ganancia: v.ganancia })),
              saldos: [],
              pagos: cs.map((c, i) => ({ id: `p${i}`, clienteId: `c${i % 2}`, dia: c.dia, importe: c.total, ventaId: null })),
            },
          };
          const todo = armarTablero(datos, "todo");
          const meses = ["2026-09", "2026-10", "2026-11", "2026-12"].map((m) => armarTablero(datos, m));
          const suma = (f: (t: typeof todo) => number) => meses.reduce((s, t) => s + f(t), 0);
          expect(suma((t) => t.ventas.importe)).toBe(todo.ventas.importe);
          expect(suma((t) => t.cobrado.total)).toBe(todo.cobrado.total);
          expect(suma((t) => t.perdidas.costoArs)).toBe(todo.perdidas.costoArs);
          expect(suma((t) => t.ganancia.neta)).toBe(todo.ganancia.neta);
          expect(todo.acumulada.neta).toBe(todo.ganancia.neta);
        },
      ),
    );
  });
});

describe("diaDeudaMasVieja (Inicio: 'la deuda más vieja es de…')", () => {
  const deuda = (id: string, dia: string, importe: number) => ({ id, tipo: "venta" as const, dia, orden: 0, importe });
  it("es la deuda más vieja que todavía tiene saldo (lo cobrado tapa primero las viejas)", () => {
    const cuenta = aplicarCreditos([deuda("v1", "2026-10-05", 1_000), deuda("v2", "2026-10-20", 1_000)], [1_500]);
    expect(diaDeudaMasVieja(cuenta)).toBe("2026-10-20");
  });
  it("sin deuda pendiente (o con saldo a favor): null", () => {
    expect(diaDeudaMasVieja(aplicarCreditos([deuda("v1", "2026-10-05", 1_000)], [1_000]))).toBeNull();
    expect(diaDeudaMasVieja(aplicarCreditos([], [500]))).toBeNull();
  });
});
