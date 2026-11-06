import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  convertirDolaresAPesos,
  formatearDolares,
  formatearPesos,
  formatearTipoDeCambio,
  multiplicar,
  parsearImporte,
} from "./dinero";

const centavosPositivos = fc.integer({ min: 0, max: 10_000_000_000_000 }); // hasta $100.000 millones

describe("formatearPesos", () => {
  it.each([
    [0, "$ 0"],
    [50, "$ 0,50"],
    [1_000_000, "$ 10.000"],
    [1_234_550, "$ 12.345,50"],
    [1_234_505, "$ 12.345,05"],
    [26_750_000, "$ 267.500"],
    [-100_000, "-$ 1.000"],
  ])("%i centavos -> %s", (centavos, esperado) => {
    expect(formatearPesos(centavos)).toBe(esperado);
  });

  it("rechaza montos con decimales de punto flotante", () => {
    expect(() => formatearPesos(10.5)).toThrow(RangeError);
  });
});

describe("formatearDolares y tipo de cambio", () => {
  it("dólares siempre con dos decimales", () => {
    expect(formatearDolares(499)).toBe("USD 4,99");
    expect(formatearDolares(5_000)).toBe("USD 50,00");
    expect(formatearDolares(19_500)).toBe("USD 195,00");
  });
  it("tipo de cambio en pesos por dólar", () => {
    expect(formatearTipoDeCambio(123_750)).toBe("$ 1.237,50");
    expect(formatearTipoDeCambio(140_000)).toBe("$ 1.400");
  });
});

describe("parsearImporte", () => {
  it.each([
    ["12345", 1_234_500],
    ["12.345", 1_234_500],
    ["12345,5", 1_234_550],
    ["12.345,50", 1_234_550],
    ["$ 12.345,50", 1_234_550],
    ["$12.345", 1_234_500],
    ["USD 4,99", 499],
    ["  1.237,50 ", 123_750],
    [",5", 50],
    ["0", 0],
    ["1.234.567,89", 123_456_789],
  ])('"%s" -> %i centavos', (texto, esperado) => {
    expect(parsearImporte(texto)).toEqual({ ok: true, centavos: esperado });
  });

  it.each([
    [""],
    ["   "],
    ["-100"],
    ["12.50"], // ambiguo: no se adivina
    ["1.2345"],
    ["12,345"], // tres decimales
    ["1,2,3"],
    ["12a"],
    ["1.000.00"],
  ])('rechaza "%s"', (texto) => {
    expect(parsearImporte(texto).ok).toBe(false);
  });

  it("formatear y volver a leer da el mismo monto (pesos)", () => {
    fc.assert(
      fc.property(centavosPositivos, (c) => {
        expect(parsearImporte(formatearPesos(c))).toEqual({ ok: true, centavos: c });
      }),
    );
  });

  it("formatear y volver a leer da el mismo monto (dólares)", () => {
    fc.assert(
      fc.property(centavosPositivos, (c) => {
        expect(parsearImporte(formatearDolares(c))).toEqual({ ok: true, centavos: c });
      }),
    );
  });
});

describe("convertirDolaresAPesos (costo de compra)", () => {
  it("ejemplos del plan", () => {
    expect(convertirDolaresAPesos(500, 120_000)).toBe(600_000); // USD 5 × $1.200 = $6.000
    expect(convertirDolaresAPesos(500, 140_000)).toBe(700_000); // USD 5 × $1.400 = $7.000
    expect(convertirDolaresAPesos(300, 150_000)).toBe(450_000); // USD 3 × $1.500 = $4.500
  });

  it("redondea al centavo, la mitad hacia arriba", () => {
    expect(convertirDolaresAPesos(499, 123_750)).toBe(617_513); // $6.175,125 -> $6.175,13
    expect(convertirDolaresAPesos(1, 1)).toBe(0); // $0,0001 -> $0
    expect(convertirDolaresAPesos(1, 50)).toBe(1); // $0,005 -> $0,01
    expect(convertirDolaresAPesos(1, 49)).toBe(0); // $0,0049 -> $0
  });

  it("costo cero da cero", () => {
    expect(convertirDolaresAPesos(0, 140_000)).toBe(0);
  });

  it("rechaza tipo de cambio cero o negativo, y valores no enteros", () => {
    expect(() => convertirDolaresAPesos(500, 0)).toThrow(RangeError);
    expect(() => convertirDolaresAPesos(500, -1)).toThrow(RangeError);
    expect(() => convertirDolaresAPesos(-1, 140_000)).toThrow(RangeError);
    expect(() => convertirDolaresAPesos(4.99, 140_000)).toThrow(RangeError);
  });

  it("el error de redondeo nunca supera medio centavo", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }), // hasta USD 100.000 por unidad
        fc.integer({ min: 1, max: 100_000_000 }), // hasta $1.000.000 por dólar
        (usd, tc) => {
          const pesos = BigInt(convertirDolaresAPesos(usd, tc));
          const exacto = BigInt(usd) * BigInt(tc); // en centésimos de centavo
          const diferencia = pesos * 100n - exacto;
          // Mitad hacia arriba: el redondeo queda en (-0,5 ; +0,5] centavos.
          expect(diferencia > -50n && diferencia <= 50n).toBe(true);
        },
      ),
    );
  });

  it("a mayor tipo de cambio, nunca menor costo en pesos", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 1, max: 50_000_000 }),
        fc.integer({ min: 0, max: 50_000_000 }),
        (usd, tc, aumento) => {
          expect(convertirDolaresAPesos(usd, tc + aumento)).toBeGreaterThanOrEqual(
            convertirDolaresAPesos(usd, tc),
          );
        },
      ),
    );
  });
});

describe("multiplicar", () => {
  it("unitario × cantidad", () => {
    expect(multiplicar(700_000, 20)).toBe(14_000_000);
  });
  it("rechaza cantidades no enteras y desbordes", () => {
    expect(() => multiplicar(100, 1.5)).toThrow(RangeError);
    expect(() => multiplicar(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });
});
