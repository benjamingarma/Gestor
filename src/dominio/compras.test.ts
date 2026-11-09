import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calcularCostosCompra, validarCompra, MAXIMA_CANTIDAD, MAXIMO_COSTO_USD, MAXIMO_TIPO_DE_CAMBIO } from "./compras";

const HOY = "2026-11-09";
const base = {
  productoId: "p1",
  fecha: "2026-10-01",
  cantidad: "20",
  costoUnitarioUsd: "5,00",
  tipoDeCambio: "1.400",
};

describe("calcularCostosCompra (sección 6.1 del plan)", () => {
  it.each([
    // cantidad, USD/u, TC, $/u, total USD, total $
    [10, 500, 120_000, 600_000, 5_000, 6_000_000], // C1
    [20, 500, 140_000, 700_000, 10_000, 14_000_000], // C2
    [15, 300, 150_000, 450_000, 4_500, 6_750_000], // C3
    [3, 499, 123_750, 617_513, 1_497, 1_852_539], // redondeo
  ])("%i × USD %i a TC %i", (cant, usd, tc, unit, totUsd, totArs) => {
    expect(calcularCostosCompra(cant, usd, tc)).toEqual({
      costoUnitarioArs: unit,
      totalUsd: totUsd,
      totalArs: totArs,
    });
  });

  it("C1 + C2 + C3 = USD 195 / $267.500", () => {
    const compras = [
      calcularCostosCompra(10, 500, 120_000),
      calcularCostosCompra(20, 500, 140_000),
      calcularCostosCompra(15, 300, 150_000),
    ];
    expect(compras.reduce((s, c) => s + c.totalUsd, 0)).toBe(19_500);
    expect(compras.reduce((s, c) => s + c.totalArs, 0)).toBe(26_750_000);
  });

  it("coincide con la fórmula de la base: (usd × tc + 50) / 100, y total = cantidad × unitario", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAXIMA_CANTIDAD }),
        fc.integer({ min: 0, max: MAXIMO_COSTO_USD }),
        fc.integer({ min: 1, max: MAXIMO_TIPO_DE_CAMBIO }),
        (cant, usd, tc) => {
          const c = calcularCostosCompra(cant, usd, tc);
          const unitarioBase = (BigInt(usd) * BigInt(tc) + 50n) / 100n; // misma expresión que la columna generada
          expect(BigInt(c.costoUnitarioArs)).toBe(unitarioBase);
          expect(BigInt(c.totalArs)).toBe(BigInt(cant) * unitarioBase);
          expect(c.totalUsd).toBe(cant * usd);
        },
      ),
    );
  });

  it("partir una compra en dos partes no pierde ni agrega centavos (base del cierre de capital)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 1000 }),
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (cant, usd, tc, fraccion) => {
          const vendidas = Math.min(cant - 1, Math.max(1, Math.floor(cant * fraccion)));
          const total = calcularCostosCompra(cant, usd, tc);
          const parte1 = calcularCostosCompra(vendidas, usd, tc);
          const parte2 = calcularCostosCompra(cant - vendidas, usd, tc);
          expect(parte1.totalArs + parte2.totalArs).toBe(total.totalArs);
          expect(parte1.totalUsd + parte2.totalUsd).toBe(total.totalUsd);
        },
      ),
    );
  });
});

describe("validarCompra", () => {
  it("acepta un formulario correcto y calcula costos", () => {
    const r = validarCompra(base, HOY);
    expect(r).toEqual({
      ok: true,
      compra: { productoId: "p1", fecha: "2026-10-01", cantidad: 20, costoUnitarioUsd: 500, tipoDeCambio: 140_000 },
      costos: { costoUnitarioArs: 700_000, totalUsd: 10_000, totalArs: 14_000_000 },
    });
  });

  it("acepta tipo de cambio con centavos y cantidad con punto de miles", () => {
    const r = validarCompra({ ...base, cantidad: "1.000", tipoDeCambio: "1.237,50" }, HOY);
    expect(r.ok && r.compra.cantidad).toBe(1000);
    expect(r.ok && r.compra.tipoDeCambio).toBe(123_750);
  });

  it("acepta la fecha de hoy", () => {
    expect(validarCompra({ ...base, fecha: HOY }, HOY).ok).toBe(true);
  });

  it.each([
    ["productoId", { productoId: "" }],
    ["fecha", { fecha: "2026-11-10" }], // futura
    ["fecha", { fecha: "" }],
    ["fecha", { fecha: "2019-12-31" }],
    ["cantidad", { cantidad: "0" }],
    ["cantidad", { cantidad: "1,5" }],
    ["cantidad", { cantidad: "-3" }],
    ["cantidad", { cantidad: "10001" }],
    ["costoUnitarioUsd", { costoUnitarioUsd: "10.000,01" }],
    ["tipoDeCambio", { tipoDeCambio: "100.000,01" }],
    ["costoUnitarioUsd", { costoUnitarioUsd: "" }],
    ["costoUnitarioUsd", { costoUnitarioUsd: "5.5" }], // ambiguo
    ["tipoDeCambio", { tipoDeCambio: "0" }],
    ["tipoDeCambio", { tipoDeCambio: "abc" }],
  ])("marca error en %s", (campo, cambio) => {
    const r = validarCompra({ ...base, ...cambio }, HOY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toHaveProperty(campo);
  });

  it("costo cero en USD está permitido (mercadería sin costo)", () => {
    expect(validarCompra({ ...base, costoUnitarioUsd: "0" }, HOY).ok).toBe(true);
  });
});
