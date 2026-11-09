import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { aplicarCreditos, estadoCobro, type Deuda } from "./cuentaCorriente";

// Bruno, sección 6.5 del plan.
const SI: Deuda = { id: "SI", tipo: "saldo_inicial", dia: "2026-09-01", orden: 1, importe: 2_000_000 };
const V2: Deuda = { id: "V2", tipo: "venta", dia: "2026-10-06", orden: 2, importe: 4_750_000 };
const V3: Deuda = { id: "V3", tipo: "venta", dia: "2026-10-20", orden: 3, importe: 3_150_000 };

const resumen = (c: ReturnType<typeof aplicarCreditos>) => c.deudas.map((d) => [d.id, d.cobrado, d.saldo]);

describe("ejemplo del plan (Bruno)", () => {
  it("sin pagos: debe todo", () => {
    const c = aplicarCreditos([V3, V2, SI], []);
    expect(resumen(c)).toEqual([["SI", 0, 2_000_000], ["V2", 0, 4_750_000], ["V3", 0, 3_150_000]]);
    expect(c).toMatchObject({ totalDeudas: 9_900_000, saldo: 9_900_000, debe: 9_900_000, aFavor: 0 });
  });

  it("Pago 1 de $50.000: cubre el saldo inicial y parte de V2; debe $49.000", () => {
    const c = aplicarCreditos([SI, V2, V3], [5_000_000]);
    expect(resumen(c)).toEqual([["SI", 2_000_000, 0], ["V2", 3_000_000, 1_750_000], ["V3", 0, 3_150_000]]);
    expect(c.debe).toBe(4_900_000);
  });

  it("Pago 2 de $50.000: cancela todo y quedan $1.000 a favor", () => {
    const c = aplicarCreditos([SI, V2, V3], [5_000_000, 5_000_000]);
    expect(resumen(c)).toEqual([["SI", 2_000_000, 0], ["V2", 4_750_000, 0], ["V3", 3_150_000, 0]]);
    expect(c).toMatchObject({ saldo: -100_000, debe: 0, aFavor: 100_000 });
  });

  it("anular el Pago 2 vuelve al estado del Pago 1", () => {
    expect(resumen(aplicarCreditos([SI, V2, V3], [5_000_000]))).toEqual(resumen(aplicarCreditos([V3, SI, V2], [5_000_000])));
  });

  it("saldo a favor se aplica a una venta nueva", () => {
    const V4: Deuda = { id: "V4", tipo: "venta", dia: "2026-11-01", orden: 4, importe: 500_000 };
    const c = aplicarCreditos([SI, V2, V3, V4], [5_000_000, 5_000_000]);
    expect(c.deudas.at(-1)).toMatchObject({ id: "V4", cobrado: 100_000, saldo: 400_000 });
    expect(c.debe).toBe(400_000);
  });

  it("saldo inicial a favor funciona como un pago", () => {
    const c = aplicarCreditos([V2], [1_000_000]);
    expect(c.deudas[0]).toMatchObject({ cobrado: 1_000_000, saldo: 3_750_000 });
  });

  it("Ana: venta de $120.000 con pago de $60.000", () => {
    const c = aplicarCreditos([{ id: "V1", tipo: "venta", dia: "2026-10-05", orden: 1, importe: 12_000_000 }], [6_000_000]);
    expect(c.deudas[0]).toMatchObject({ cobrado: 6_000_000, saldo: 6_000_000 });
    expect(estadoCobro(c.deudas[0])).toBe("parcial");
  });
});

describe("orden de aplicación", () => {
  it("el mismo día, el saldo inicial va antes que la venta", () => {
    const venta: Deuda = { id: "V", tipo: "venta", dia: "2026-10-01", orden: 1, importe: 100 };
    const inicial: Deuda = { id: "S", tipo: "saldo_inicial", dia: "2026-10-01", orden: 9, importe: 100 };
    expect(aplicarCreditos([venta, inicial], [100]).deudas[0].id).toBe("S");
  });
  it("el mismo día y tipo, por orden de carga", () => {
    const a: Deuda = { id: "A", tipo: "venta", dia: "2026-10-01", orden: 2, importe: 100 };
    const b: Deuda = { id: "B", tipo: "venta", dia: "2026-10-01", orden: 1, importe: 100 };
    expect(aplicarCreditos([a, b], [100]).deudas.map((d) => [d.id, d.cobrado])).toEqual([["B", 100], ["A", 0]]);
  });
  it("una venta de $0 queda pagada sin consumir crédito", () => {
    const c = aplicarCreditos([{ id: "Z", tipo: "venta", dia: "2026-10-01", orden: 1, importe: 0 }, V2], [100]);
    expect(c.deudas.map((d) => d.cobrado)).toEqual([0, 100]);
    expect(estadoCobro(c.deudas[0])).toBe("pagada");
  });
  it("rechaza importes inválidos", () => {
    expect(() => aplicarCreditos([V2], [0])).toThrow(RangeError);
    expect(() => aplicarCreditos([V2], [1.5])).toThrow(RangeError);
    expect(() => aplicarCreditos([{ ...V2, importe: -1 }], [])).toThrow(RangeError);
  });
});

describe("propiedades (fast-check)", () => {
  const deuda = fc.record({
    id: fc.uuid(),
    tipo: fc.constantFrom("saldo_inicial" as const, "venta" as const),
    dia: fc.constantFrom("2026-09-01", "2026-09-15", "2026-10-01", "2026-10-20"),
    orden: fc.nat(1000),
    importe: fc.integer({ min: 0, max: 50_000_000 }),
  });
  const creditos = fc.array(fc.integer({ min: 1, max: 50_000_000 }), { maxLength: 8 });
  const deudas = fc.uniqueArray(deuda, { selector: (d) => d.id, maxLength: 10 });

  it("cobrado total = mínimo entre créditos y deudas; nada se cobra de más; saldo = deudas − créditos", () => {
    fc.assert(
      fc.property(deudas, creditos, (ds, cs) => {
        const c = aplicarCreditos(ds, cs);
        const cobrado = c.deudas.reduce((s, d) => s + d.cobrado, 0);
        expect(cobrado).toBe(Math.min(c.totalCreditos, c.totalDeudas));
        for (const d of c.deudas) {
          expect(d.cobrado).toBeGreaterThanOrEqual(0);
          expect(d.cobrado).toBeLessThanOrEqual(d.importe);
          expect(d.saldo).toBe(d.importe - d.cobrado);
        }
        expect(c.saldo).toBe(c.totalDeudas - c.totalCreditos);
        expect(c.debe - c.aFavor).toBe(c.saldo); // I4
        expect(c.debe === 0 || c.aFavor === 0).toBe(true);
      }),
    );
  });

  it("FIFO: si una deuda quedó con saldo, ninguna posterior recibió pago", () => {
    fc.assert(
      fc.property(deudas, creditos, (ds, cs) => {
        const c = aplicarCreditos(ds, cs);
        const i = c.deudas.findIndex((d) => d.saldo > 0);
        if (i >= 0) for (const d of c.deudas.slice(i + 1)) expect(d.cobrado).toBe(0);
      }),
    );
  });

  it("el resultado no depende del orden en que se cargaron los pagos ni las ventas", () => {
    fc.assert(
      fc.property(deudas, creditos, fc.integer(), (ds, cs, semilla) => {
        const mezclar = <T,>(xs: T[]) => [...xs].sort(() => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280) - 0.5);
        expect(resumen(aplicarCreditos(mezclar(ds), mezclar(cs)))).toEqual(resumen(aplicarCreditos(ds, cs)));
      }),
    );
  });

  it("dividir un pago en varios da el mismo resultado", () => {
    fc.assert(
      fc.property(deudas, fc.integer({ min: 2, max: 50_000_000 }), fc.integer({ min: 1, max: 1_000_000 }), (ds, total, parte) => {
        fc.pre(parte < total);
        expect(resumen(aplicarCreditos(ds, [parte, total - parte]))).toEqual(resumen(aplicarCreditos(ds, [total])));
      }),
    );
  });
});
