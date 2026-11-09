import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { precioPropuesto, simularFifo, totalesVenta, type CompraDisponible } from "./ventas";

// Escenario de la sección 6 del plan.
const C1: CompraDisponible = { compraId: "C1", fecha: "2026-09-01", secuencia: 1, disponible: 10, costoUnitarioArs: 600_000, costoUnitarioUsd: 500 };
const C2: CompraDisponible = { compraId: "C2", fecha: "2026-10-01", secuencia: 2, disponible: 20, costoUnitarioArs: 700_000, costoUnitarioUsd: 500 };
const C3: CompraDisponible = { compraId: "C3", fecha: "2026-10-02", secuencia: 3, disponible: 15, costoUnitarioArs: 450_000, costoUnitarioUsd: 300 };

describe("precio propuesto: especial -> último pagado -> general", () => {
  it.each([
    [{ especial: 1_050_000, ultimoPagado: 990_000, general: 1_000_000 }, { precio: 1_050_000, origen: "especial" }],
    [{ especial: null, ultimoPagado: 990_000, general: 1_000_000 }, { precio: 990_000, origen: "ultimo" }],
    [{ especial: null, ultimoPagado: null, general: 1_000_000 }, { precio: 1_000_000, origen: "general" }],
    [{ especial: null, ultimoPagado: null, general: null }, { precio: null, origen: "ninguno" }],
    [{ especial: 0, ultimoPagado: 990_000, general: 1_000_000 }, { precio: 0, origen: "especial" }], // $0 es un precio válido
  ] as const)("%o", (entrada, esperado) => {
    expect(precioPropuesto(entrada)).toEqual(esperado);
  });
});

describe("simularFifo", () => {
  it("V1: 12 unidades cruzan dos compras con distinto tipo de cambio", () => {
    const r = simularFifo([C2, C1], 12); // el orden de entrada no importa
    expect(r).toEqual({
      consumos: [
        { compraId: "C1", cantidad: 10, costoUnitarioArs: 600_000, costoUnitarioUsd: 500 },
        { compraId: "C2", cantidad: 2, costoUnitarioArs: 700_000, costoUnitarioUsd: 500 },
      ],
      costoArs: 7_400_000,
      costoUsd: 6_000,
      faltan: 0,
    });
  });

  it("a igual fecha, sale primero la cargada antes", () => {
    const a = { ...C2, compraId: "A", secuencia: 5, costoUnitarioArs: 1 };
    const b = { ...C2, compraId: "B", secuencia: 4, costoUnitarioArs: 2 };
    expect(simularFifo([a, b], 1).consumos[0].compraId).toBe("B");
  });

  it("saltea compras sin stock e informa lo que falta", () => {
    const r = simularFifo([{ ...C1, disponible: 0 }, { ...C2, disponible: 3 }], 5);
    expect(r.consumos).toEqual([{ compraId: "C2", cantidad: 3, costoUnitarioArs: 700_000, costoUnitarioUsd: 500 }]);
    expect(r.faltan).toBe(2);
  });

  it("propiedades: nunca consume más de lo disponible, y lo consumido + lo que falta = lo pedido", () => {
    const compra = fc.record({
      compraId: fc.uuid(),
      fecha: fc.constantFrom("2026-01-01", "2026-02-01", "2026-03-01"),
      secuencia: fc.nat(1000),
      disponible: fc.integer({ min: -2, max: 50 }),
      costoUnitarioArs: fc.integer({ min: 0, max: 10_000_000 }),
      costoUnitarioUsd: fc.integer({ min: 0, max: 100_000 }),
    });
    fc.assert(
      fc.property(fc.array(compra, { maxLength: 8 }), fc.integer({ min: 0, max: 200 }), (compras, cantidad) => {
        const r = simularFifo(compras, cantidad);
        const consumido = r.consumos.reduce((s, c) => s + c.cantidad, 0);
        expect(consumido + r.faltan).toBe(cantidad);
        const disponibleTotal = compras.reduce((s, c) => s + Math.max(0, c.disponible), 0);
        expect(r.faltan).toBe(Math.max(0, cantidad - disponibleTotal));
        expect(r.costoArs).toBe(r.consumos.reduce((s, c) => s + c.cantidad * c.costoUnitarioArs, 0));
        for (const c of r.consumos) expect(c.cantidad).toBeGreaterThan(0);
      }),
    );
  });

  it("vender en dos partes cuesta lo mismo que vender todo junto (sin perder centavos)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 45 }), fc.integer({ min: 0, max: 45 }), (a, b) => {
        fc.pre(a + b <= 45);
        const juntas = simularFifo([C1, C2, C3].map((c) => ({ ...c })), a + b);
        const primera = simularFifo([C1, C2, C3], a);
        const queda = [C1, C2, C3].map((c) => ({
          ...c,
          disponible: c.disponible - (primera.consumos.find((x) => x.compraId === c.compraId)?.cantidad ?? 0),
        }));
        const segunda = simularFifo(queda, b);
        expect(primera.costoArs + segunda.costoArs).toBe(juntas.costoArs);
        expect(primera.costoUsd + segunda.costoUsd).toBe(juntas.costoUsd);
      }),
    );
  });
});

describe("totalesVenta (sección 6 del plan)", () => {
  it("V2: dos productos", () => {
    expect(
      totalesVenta([
        { cantidad: 3, precioUnitario: 1_050_000, costoArs: 2_100_000, costoUsd: 1_500 },
        { cantidad: 2, precioUnitario: 800_000, costoArs: 900_000, costoUsd: 600 },
      ]),
    ).toEqual({ unidades: 5, importe: 4_750_000, costoArs: 3_000_000, costoUsd: 2_100, ganancia: 1_750_000 });
  });
  it("V1 + V2 + V3: ventas $199.000, costo $125.000, ganancia $74.000", () => {
    const v1 = simularFifo([C1, C2, C3].filter((c) => c.compraId !== "C3"), 12);
    const t = totalesVenta([
      { cantidad: 12, precioUnitario: 1_000_000, costoArs: v1.costoArs, costoUsd: v1.costoUsd },
      { cantidad: 3, precioUnitario: 1_050_000, costoArs: 2_100_000, costoUsd: 1_500 },
      { cantidad: 2, precioUnitario: 800_000, costoArs: 900_000, costoUsd: 600 },
      { cantidad: 3, precioUnitario: 1_050_000, costoArs: 2_100_000, costoUsd: 1_500 },
    ]);
    expect(t).toMatchObject({ importe: 19_900_000, costoArs: 12_500_000, costoUsd: 9_600, ganancia: 7_400_000 });
  });
  it("una venta a pérdida da ganancia negativa", () => {
    expect(totalesVenta([{ cantidad: 1, precioUnitario: 500_000, costoArs: 700_000, costoUsd: 500 }]).ganancia).toBe(-200_000);
  });
});
