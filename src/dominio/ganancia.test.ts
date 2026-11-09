import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calcularGanancia, porcentajesIguales, repartir, vigenteEn, type Socio, type Vigencia } from "./ganancia";

const BENJA: Socio = { id: "b", nombre: "Benjamín", orden: 1 };
const PAPA: Socio = { id: "p", nombre: "Papá", orden: 2 };
const SOCIOS = [PAPA, BENJA]; // desordenados a propósito
const MITAD = porcentajesIguales(SOCIOS);
const importes = (partes: { importe: number }[]) => partes.map((p) => p.importe);

describe("repartir", () => {
  it("50/50 por defecto, en el orden de los socios", () => {
    expect(MITAD).toEqual([{ socioId: "b", centesimos: 5000 }, { socioId: "p", centesimos: 5000 }]);
    expect(repartir(6_700_000, SOCIOS, MITAD)).toEqual([
      { socioId: "b", nombre: "Benjamín", importe: 3_350_000 },
      { socioId: "p", nombre: "Papá", importe: 3_350_000 },
    ]);
  });
  it("el centavo que sobra va al primer socio ($10.000,01 -> $5.000,01 + $5.000,00)", () => {
    expect(importes(repartir(1_000_001, SOCIOS, MITAD))).toEqual([500_001, 500_000]);
  });
  it("60/40 y 100/0", () => {
    expect(importes(repartir(1_000_000, SOCIOS, [{ socioId: "b", centesimos: 6000 }, { socioId: "p", centesimos: 4000 }]))).toEqual([600_000, 400_000]);
    expect(importes(repartir(1_000_000, SOCIOS, [{ socioId: "b", centesimos: 0 }, { socioId: "p", centesimos: 10000 }]))).toEqual([0, 1_000_000]);
  });
  it("porcentajes con decimales (33,33 %)", () => {
    const tres = [BENJA, PAPA, { id: "t", nombre: "Tercero", orden: 3 }];
    expect(porcentajesIguales(tres).map((p) => p.centesimos)).toEqual([3334, 3333, 3333]);
    expect(importes(repartir(100, tres, porcentajesIguales(tres)))).toEqual([34, 33, 33]);
  });
  it("ganancia negativa (más pérdidas que ganancia)", () => {
    // −$10.000,01: cada mitad hacia abajo da −$5.000,01; el centavo que sobra va al primero.
    expect(importes(repartir(-1_000_001, SOCIOS, MITAD))).toEqual([-500_000, -500_001]);
  });
  it("rechaza porcentajes que no suman 100", () => {
    expect(() => repartir(100, SOCIOS, [{ socioId: "b", centesimos: 5000 }, { socioId: "p", centesimos: 4000 }])).toThrow(RangeError);
  });
  it("propiedad: la suma de las partes es SIEMPRE exactamente el total", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e13, max: 1e13 }), fc.integer({ min: 0, max: 10_000 }), (total, b) => {
        const partes = repartir(total, SOCIOS, [{ socioId: "b", centesimos: b }, { socioId: "p", centesimos: 10_000 - b }]);
        expect(partes[0].importe + partes[1].importe).toBe(total);
        // La parte del segundo socio es exactamente lo que le toca, redondeado hacia abajo
        // (calculado con enteros exactos: con decimales de JavaScript se pierde precisión en montos grandes).
        const exacto = BigInt(total) * BigInt(10_000 - b);
        const piso = exacto / 10_000n - (exacto % 10_000n !== 0n && exacto < 0n ? 1n : 0n);
        expect(BigInt(partes[1].importe)).toBe(piso);
      }),
    );
  });
});

describe("vigencia de porcentajes", () => {
  const vigencias: Vigencia[] = [
    { desde: "2026-11-01", porcentajes: [{ socioId: "b", centesimos: 6000 }, { socioId: "p", centesimos: 4000 }] },
    { desde: "2026-12-01", porcentajes: [{ socioId: "b", centesimos: 5000 }, { socioId: "p", centesimos: 5000 }] },
  ];
  it("sin vigencias: partes iguales", () => {
    expect(vigenteEn([], "2026-10-05", SOCIOS)).toEqual(MITAD);
  });
  it("antes de la primera vigencia: partes iguales", () => {
    expect(vigenteEn(vigencias, "2026-10-31", SOCIOS)).toEqual(MITAD);
  });
  it("cada día usa la última vigencia que ya empezó", () => {
    expect(vigenteEn(vigencias, "2026-11-01", SOCIOS)[0].centesimos).toBe(6000);
    expect(vigenteEn(vigencias, "2026-11-30", SOCIOS)[0].centesimos).toBe(6000);
    expect(vigenteEn(vigencias, "2026-12-01", SOCIOS)[0].centesimos).toBe(5000);
  });
  it("cambiar el porcentaje no cambia lo ya repartido", () => {
    const octubre = [{ dia: "2026-10-05", ganancia: 1_000_000 }];
    const antes = calcularGanancia(octubre, [], SOCIOS, []);
    const despues = calcularGanancia(octubre, [], SOCIOS, vigencias);
    expect(despues.partes).toEqual(antes.partes);
  });
  it("un período con dos porcentajes reparte cada tramo con el suyo", () => {
    const r = calcularGanancia(
      [
        { dia: "2026-10-20", ganancia: 1_000_000 }, // 50/50
        { dia: "2026-11-10", ganancia: 1_000_000 }, // 60/40
      ],
      [],
      SOCIOS,
      vigencias,
    );
    expect(importes(r.partes)).toEqual([1_100_000, 900_000]);
  });
});

describe("ejemplo del plan (sección 6.7)", () => {
  const ventas = [
    { dia: "2026-10-05", ganancia: 4_600_000 }, // V1 Ana
    { dia: "2026-10-06", ganancia: 1_750_000 }, // V2 Bruno
    { dia: "2026-10-20", ganancia: 1_050_000 }, // V3 Bruno
  ];
  it("sin ajustes: bruta = neta = $74.000, $37.000 cada uno", () => {
    expect(calcularGanancia(ventas, [], SOCIOS, [])).toEqual({
      bruta: 7_400_000,
      perdidas: 0,
      neta: 7_400_000,
      partes: [
        { socioId: "b", nombre: "Benjamín", importe: 3_700_000 },
        { socioId: "p", nombre: "Papá", importe: 3_700_000 },
      ],
    });
  });
  it("con la rotura de $7.000 (módulo 1.6): neta $67.000, $33.500 cada uno", () => {
    const r = calcularGanancia(ventas, [{ dia: "2026-10-28", costo: 700_000 }], SOCIOS, []);
    expect(r).toMatchObject({ bruta: 7_400_000, perdidas: 700_000, neta: 6_700_000 });
    expect(importes(r.partes)).toEqual([3_350_000, 3_350_000]);
  });
  it("propiedad: con cualquier mezcla de ventas, pérdidas y vigencias, las partes suman la neta (I6)", () => {
    const dia = fc.constantFrom("2026-10-01", "2026-10-15", "2026-11-01", "2026-11-20", "2026-12-05");
    fc.assert(
      fc.property(
        fc.array(fc.record({ dia, ganancia: fc.integer({ min: -5_000_000, max: 50_000_000 }) }), { maxLength: 20 }),
        fc.array(fc.record({ dia, costo: fc.integer({ min: 0, max: 5_000_000 }) }), { maxLength: 5 }),
        fc.array(fc.record({ desde: dia, b: fc.integer({ min: 0, max: 10_000 }) }), { maxLength: 3 }),
        (vs, ps, vg) => {
          const vigencias = vg.map((v) => ({ desde: v.desde, porcentajes: [{ socioId: "b", centesimos: v.b }, { socioId: "p", centesimos: 10_000 - v.b }] }));
          const r = calcularGanancia(vs, ps, SOCIOS, vigencias);
          expect(r.neta).toBe(r.bruta - r.perdidas);
          expect(r.partes.reduce((s, p) => s + p.importe, 0)).toBe(r.neta);
        },
      ),
    );
  });
});
