import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { costoDelAjuste, MOTIVOS, nombreDelMotivo, perdidasParaGanancia, totalesPerdidas, validarAjuste, type FilaPerdida } from "./ajustes";
import { calcularGanancia, type Socio } from "./ganancia";
import { enPeriodo } from "./resumen";
import type { CompraDisponible } from "./ventas";

const HOY = "2026-11-09";
const campos = (c: Partial<{ motivo: string; cantidad: string; fecha: string; nota: string }> = {}) => ({
  motivo: "rotura",
  cantidad: "1",
  fecha: "2026-10-28",
  nota: "",
  ...c,
});

describe("validarAjuste", () => {
  it("acepta una rotura de 1 unidad", () => {
    expect(validarAjuste(campos({ nota: "  Se cayó  " }), HOY, 11)).toEqual({
      ok: true,
      ajuste: { motivo: "rotura", cantidad: 1, fecha: "2026-10-28", nota: "Se cayó" },
    });
  });
  it("los tres motivos del plan, y ningún otro", () => {
    expect(MOTIVOS.map((m) => m.valor)).toEqual(["regalo", "perdida", "rotura"]);
    for (const m of MOTIVOS) expect(validarAjuste(campos({ motivo: m.valor }), HOY, 5).ok).toBe(true);
    expect(validarAjuste(campos({ motivo: "robo" }), HOY, 5)).toMatchObject({ ok: false, errores: { motivo: expect.any(String) } });
    expect(validarAjuste(campos({ motivo: "" }), HOY, 5).ok).toBe(false);
    expect(nombreDelMotivo("perdida")).toBe("Pérdida");
  });
  it("cantidad entera mayor a 0 y no más que el stock (solo salidas, A9)", () => {
    for (const c of ["0", "-1", "1,5", "abc", ""]) {
      expect(validarAjuste(campos({ cantidad: c }), HOY, 5)).toMatchObject({ ok: false, errores: { cantidad: expect.any(String) } });
    }
    expect(validarAjuste(campos({ cantidad: "6" }), HOY, 5)).toMatchObject({ ok: false, errores: { cantidad: "No hay tantas: quedan 5 en stock." } });
    expect(validarAjuste(campos({ cantidad: "5" }), HOY, 5).ok).toBe(true);
    expect(validarAjuste(campos({ cantidad: "10.001" }), HOY, 20_000)).toMatchObject({ ok: false, errores: { cantidad: "La cantidad es demasiado grande." } });
  });
  it("fecha: hoy o pasada, nunca futura (A3)", () => {
    expect(validarAjuste(campos({ fecha: HOY }), HOY, 5).ok).toBe(true);
    expect(validarAjuste(campos({ fecha: "2026-11-10" }), HOY, 5)).toMatchObject({ ok: false, errores: { fecha: "La fecha no puede ser futura." } });
    expect(validarAjuste(campos({ fecha: "2019-12-31" }), HOY, 5).ok).toBe(false);
    expect(validarAjuste(campos({ fecha: "28/10/2026" }), HOY, 5).ok).toBe(false);
  });
  it("nota de hasta 500 letras", () => {
    expect(validarAjuste(campos({ nota: "x".repeat(500) }), HOY, 5).ok).toBe(true);
    expect(validarAjuste(campos({ nota: "x".repeat(501) }), HOY, 5).ok).toBe(false);
  });
});

// Stock de P1 después de V1, V2 y V3 (plan, sección 6): C1 vacía, C2 con 12 a $7.000 / USD 5.
const P1: CompraDisponible[] = [
  { compraId: "C1", fecha: "2026-09-01", secuencia: 1, disponible: 0, costoUnitarioArs: 600_000, costoUnitarioUsd: 500 },
  { compraId: "C2", fecha: "2026-10-01", secuencia: 2, disponible: 12, costoUnitarioArs: 700_000, costoUnitarioUsd: 500 },
];

describe("costo del ajuste (vista previa FIFO)", () => {
  it("A1 (plan 6.6): rotura de 1 × P1 sale de C2 → $7.000 / USD 5", () => {
    expect(costoDelAjuste(P1, 1)).toEqual({
      consumos: [{ compraId: "C2", cantidad: 1, costoUnitarioArs: 700_000, costoUnitarioUsd: 500 }],
      costoArs: 700_000,
      costoUsd: 500,
      faltan: 0,
    });
  });
  it("cruza dos compras con distinto costo (igual que la prueba de la base: $64.500 / USD 43)", () => {
    const p2: CompraDisponible[] = [
      { compraId: "C4", fecha: "2026-10-25", secuencia: 4, disponible: 5, costoUnitarioArs: 600_000, costoUnitarioUsd: 400 },
      { compraId: "C3", fecha: "2026-10-02", secuencia: 3, disponible: 13, costoUnitarioArs: 450_000, costoUnitarioUsd: 300 },
    ];
    expect(costoDelAjuste(p2, 14)).toMatchObject({ costoArs: 6_450_000, costoUsd: 4_300, faltan: 0 });
  });
  it("si no alcanza, avisa cuántas faltan", () => {
    expect(costoDelAjuste(P1, 13).faltan).toBe(1);
  });
  it("propiedad: dar de baja a y después b cuesta lo mismo que dar de baja a + b de una vez (FIFO no depende de cómo se parta)", () => {
    const compra = fc.record({
      disponible: fc.integer({ min: 0, max: 50 }),
      costoUnitarioArs: fc.integer({ min: 0, max: 100_000_000 }),
      costoUnitarioUsd: fc.integer({ min: 0, max: 1_000_000 }),
      fecha: fc.constantFrom("2026-09-01", "2026-10-01", "2026-10-15"),
    });
    fc.assert(
      fc.property(fc.array(compra, { minLength: 1, maxLength: 6 }), fc.nat(), fc.nat(), (cs, x, y) => {
        const compras = cs.map((c, i) => ({ ...c, compraId: `K${i}`, secuencia: i }));
        const stock = compras.reduce((s, c) => s + c.disponible, 0);
        const a = stock === 0 ? 0 : x % (stock + 1);
        const b = stock - a === 0 ? 0 : y % (stock - a + 1);
        const primero = costoDelAjuste(compras, a);
        const usado = new Map(primero.consumos.map((k) => [k.compraId, k.cantidad]));
        const resto = compras.map((c) => ({ ...c, disponible: c.disponible - (usado.get(c.compraId) ?? 0) }));
        const segundo = costoDelAjuste(resto, b);
        const juntos = costoDelAjuste(compras, a + b);
        expect(primero.costoArs + segundo.costoArs).toBe(juntos.costoArs);
        expect(primero.costoUsd + segundo.costoUsd).toBe(juntos.costoUsd);
        expect(juntos.faltan).toBe(0);
        // Dar de baja todo el stock cuesta exactamente el stock valorizado (control I3).
        const todo = costoDelAjuste(compras, stock);
        expect(todo.costoArs).toBe(compras.reduce((s, c) => s + c.disponible * c.costoUnitarioArs, 0));
        expect(todo.costoUsd).toBe(compras.reduce((s, c) => s + c.disponible * c.costoUnitarioUsd, 0));
      }),
    );
  });
});

describe("pérdidas en la ganancia (plan 6.7)", () => {
  const SOCIOS: Socio[] = [
    { id: "b", nombre: "Benjamín", orden: 1 },
    { id: "p", nombre: "Papá", orden: 2 },
  ];
  const ventas = [
    { dia: "2026-10-05", ganancia: 4_600_000 },
    { dia: "2026-10-06", ganancia: 1_750_000 },
    { dia: "2026-10-20", ganancia: 1_050_000 },
  ];
  const perdidas: FilaPerdida[] = [
    { dia: "2026-10-28", ajustes: 1, unidades: 1, costo_ars: 700_000, costo_usd: 500 }, // A1
    { dia: "2026-11-02", ajustes: 2, unidades: 3, costo_ars: 1_350_000, costo_usd: 900 }, // otro mes
  ];

  it("octubre: bruta $74.000 − pérdidas $7.000 = neta $67.000, $33.500 cada uno", () => {
    const delMes = perdidas.filter((p) => enPeriodo(p.dia, "2026-10"));
    const r = calcularGanancia(ventas, perdidasParaGanancia(delMes), SOCIOS, []);
    expect(r).toMatchObject({ bruta: 7_400_000, perdidas: 700_000, neta: 6_700_000 });
    expect(r.partes.map((p) => p.importe)).toEqual([3_350_000, 3_350_000]);
  });
  it("una pérdida de noviembre no toca la ganancia de octubre", () => {
    const delMes = perdidas.filter((p) => enPeriodo(p.dia, "2026-11"));
    expect(calcularGanancia([], perdidasParaGanancia(delMes), SOCIOS, [])).toMatchObject({ bruta: 0, perdidas: 1_350_000, neta: -1_350_000 });
  });
  it("cada pérdida se reparte con el porcentaje vigente en su fecha", () => {
    const vigencias = [{ desde: "2026-11-01", porcentajes: [{ socioId: "b", centesimos: 6000 }, { socioId: "p", centesimos: 4000 }] }];
    const r = calcularGanancia([], perdidasParaGanancia(perdidas), SOCIOS, vigencias);
    // Octubre 50/50: −3.500 c/u · Noviembre 60/40: −8.100 / −5.400
    expect(r.partes.map((p) => p.importe)).toEqual([-1_160_000, -890_000]);
  });
  it("totales de pérdidas en pesos y en dólares", () => {
    expect(totalesPerdidas(perdidas)).toEqual({ ajustes: 3, unidades: 4, costoArs: 2_050_000, costoUsd: 1_400 });
    expect(totalesPerdidas([])).toEqual({ ajustes: 0, unidades: 0, costoArs: 0, costoUsd: 0 });
  });
});
