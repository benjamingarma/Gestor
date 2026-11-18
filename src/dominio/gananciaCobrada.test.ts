import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { aplicarCreditos, type Deuda } from "./cuentaCorriente";
import { calcularGananciaCobrada, sumarDias, type PagoCobro, type SaldoInicialCobro, type VentaCobro } from "./gananciaCobrada";

const venta = (id: string, clienteId: string, dia: string, importe: number, costo: number, orden = 1): VentaCobro => ({ id, clienteId, dia, orden, importe, ganancia: importe - costo });
const pago = (id: string, clienteId: string, dia: string, importe: number, ventaId: string | null = null): PagoCobro => ({ id, clienteId, dia, importe, ventaId });
const delMes = (r: ReturnType<typeof calcularGananciaCobrada>, mes: string) => sumarDias(r.dias.filter((d) => d.dia.startsWith(mes)));

// Ejemplos numéricos de la propuesta aprobada el 18/11/2026.
describe("ejemplos de la propuesta", () => {
  it("venta $ 10.000 (costo $ 6.000), paga $ 5.000 en noviembre: $ 2.000 de ganancia en noviembre", () => {
    const r = calcularGananciaCobrada([venta("V", "c", "2026-10-10", 1_000_000, 600_000)], [], [pago("P", "c", "2026-11-05", 500_000)]);
    expect(delMes(r, "2026-10").ganancia).toBe(0);
    expect(delMes(r, "2026-11")).toMatchObject({ cobrado: 500_000, ganancia: 200_000, costoCobrado: 300_000 });
    expect(r.gananciaPendiente).toBe(200_000);
  });

  it("Ana: V1 oct y V2 nov, paga $ 15.000 en nov → $ 4.000 + $ 1.250 = $ 5.250; costo de lo cobrado $ 9.750", () => {
    const r = calcularGananciaCobrada(
      [venta("V1", "ana", "2026-10-05", 1_000_000, 600_000), venta("V2", "ana", "2026-11-02", 2_000_000, 1_500_000, 2)],
      [],
      [pago("P", "ana", "2026-11-10", 1_500_000)],
    );
    expect(delMes(r, "2026-11")).toMatchObject({ ganancia: 525_000, costoCobrado: 975_000 });
  });

  it("Carlos: $ 8.000 del papel + V3; paga $ 10.000 → $ 8.000 al papel sin ganancia y $ 500 de V3", () => {
    const r = calcularGananciaCobrada(
      [venta("V3", "carlos", "2026-11-03", 1_200_000, 900_000)],
      [{ id: "S", clienteId: "carlos", tipo: "deuda", dia: "2026-09-01", orden: 1, importe: 800_000 }],
      [pago("P", "carlos", "2026-11-12", 1_000_000)],
    );
    expect(delMes(r, "2026-11")).toMatchObject({ cobrado: 1_000_000, aPapel: 800_000, ganancia: 50_000, costoCobrado: 150_000 });
  });

  it("desglose de noviembre con Ana y Carlos: $ 25.000 − $ 8.000 − $ 11.250 = $ 5.750 (− $ 1.000 de pérdidas = $ 4.750)", () => {
    const r = calcularGananciaCobrada(
      [venta("V1", "ana", "2026-10-05", 1_000_000, 600_000), venta("V2", "ana", "2026-11-02", 2_000_000, 1_500_000, 2), venta("V3", "carlos", "2026-11-03", 1_200_000, 900_000, 3)],
      [{ id: "S", clienteId: "carlos", tipo: "deuda", dia: "2026-09-01", orden: 1, importe: 800_000 }],
      [pago("P1", "ana", "2026-11-10", 1_500_000), pago("P2", "carlos", "2026-11-12", 1_000_000)],
    );
    const t = delMes(r, "2026-11");
    expect(t).toMatchObject({ cobrado: 2_500_000, aPapel: 800_000, costoCobrado: 1_125_000, ganancia: 575_000 });
    expect(t.cobrado - t.aPapel - t.costoCobrado - 100_000).toBe(475_000);
  });
});

// Beto (decisión del 18/11/2026, camino B): debe V0 de octubre y compra V1 el 18/11.
describe("pago de la pantalla de venta (Beto)", () => {
  const V0 = venta("V0", "beto", "2026-10-10", 1_000_000, 600_000);
  const V1 = venta("V1", "beto", "2026-11-18", 2_000_000, 1_500_000, 2);
  const nov = (pagos: PagoCobro[], ventas = [V0, V1]) => delMes(calcularGananciaCobrada(ventas, [], pagos), "2026-11").ganancia;
  it('"Pagó todo" $ 20.000 → $ 5.000', () => expect(nov([pago("P", "beto", "2026-11-18", 2_000_000, "V1")])).toBe(500_000));
  it("pago parcial $ 12.000 → $ 3.000", () => expect(nov([pago("P", "beto", "2026-11-18", 1_200_000, "V1")])).toBe(300_000));
  it("pago $ 25.000 → $ 5.000 + $ 2.000 = $ 7.000", () => expect(nov([pago("P", "beto", "2026-11-18", 2_500_000, "V1")])).toBe(700_000));
  it("anular V1 devolviendo la plata → $ 0", () => expect(nov([], [V0])).toBe(0));
  it("anular V1 sin devolver → el pago cubre V0: $ 4.000 y quedan $ 10.000 a favor", () => {
    const r = calcularGananciaCobrada([V0], [], [pago("P", "beto", "2026-11-18", 2_000_000, "V1")]);
    expect(delMes(r, "2026-11")).toMatchObject({ ganancia: 400_000, quedoAFavor: 1_000_000 });
  });
});

describe("saldo a favor y casos borde", () => {
  it("la ganancia de una venta pagada con saldo a favor cuenta en la fecha de esa venta (decisión 4)", () => {
    const r = calcularGananciaCobrada([venta("V", "c", "2026-12-03", 1_000_000, 600_000)], [], [pago("P", "c", "2026-11-20", 1_000_000)]);
    expect(delMes(r, "2026-11")).toMatchObject({ cobrado: 1_000_000, quedoAFavor: 1_000_000, ganancia: 0 });
    expect(delMes(r, "2026-12")).toMatchObject({ cobrado: 0, aFavorUsado: 1_000_000, ganancia: 400_000, costoCobrado: 600_000 });
  });
  it("saldo inicial a favor del papel usado en una venta: ganancia el día de la venta", () => {
    const r = calcularGananciaCobrada([venta("V", "c", "2026-11-03", 1_000_000, 600_000)], [{ id: "F", clienteId: "c", tipo: "a_favor", dia: "2026-09-01", orden: 1, importe: 300_000 }], []);
    expect(delMes(r, "2026-11")).toMatchObject({ aFavorUsado: 300_000, ganancia: 120_000 });
  });
  it("redondeo sobre lo acumulado: tres pagos de $ 1 de una venta de $ 3 con ganancia $ 1 suman exactamente $ 1", () => {
    const r = calcularGananciaCobrada([venta("V", "c", "2026-11-01", 300, 200)], [], [pago("a", "c", "2026-11-01", 100), pago("b", "c", "2026-11-02", 100), pago("d", "c", "2026-11-03", 100)]);
    expect(r.dias.map((d) => d.ganancia)).toEqual([33, 33, 34]);
  });
  it("venta por debajo del costo: la pérdida se reconoce en proporción a lo cobrado", () => {
    const r = calcularGananciaCobrada([venta("V", "c", "2026-11-01", 1_000_000, 1_200_000)], [], [pago("P", "c", "2026-11-02", 500_000)]);
    expect(delMes(r, "2026-11").ganancia).toBe(-100_000);
  });
  it("venta de $ 0 con costo: su ganancia (−costo) cuenta el día de la venta y el desglose cierra", () => {
    const r = calcularGananciaCobrada([venta("V", "c", "2026-11-01", 0, 700_000)], [], []);
    expect(delMes(r, "2026-11")).toMatchObject({ ganancia: -700_000, costoCobrado: 700_000 });
  });
  it("rechaza importes inválidos", () => {
    expect(() => calcularGananciaCobrada([], [], [pago("P", "c", "2026-11-01", 0)])).toThrow(RangeError);
    expect(() => calcularGananciaCobrada([venta("V", "c", "2026-11-01", -1, 0)], [], [])).toThrow(RangeError);
  });
});

describe("propiedades (fast-check)", () => {
  const dias = ["2026-09-01", "2026-10-01", "2026-10-15", "2026-11-01", "2026-11-20"];
  const ids = ["v1", "v2", "v3", "v4", "v5"];
  const escenario = fc.record({
    ventas: fc.uniqueArray(
      fc.record({ id: fc.constantFrom(...ids), dia: fc.constantFrom(...dias), orden: fc.nat(100), importe: fc.integer({ min: 0, max: 3_000_000 }), costo: fc.integer({ min: 0, max: 3_000_000 }) }),
      { selector: (v) => v.id, maxLength: 5 },
    ),
    saldos: fc.array(fc.record({ tipo: fc.constantFrom("deuda" as const, "a_favor" as const), dia: fc.constantFrom(...dias), importe: fc.integer({ min: 0, max: 2_000_000 }) }), { maxLength: 2 }),
    pagos: fc.array(fc.record({ dia: fc.constantFrom(...dias), importe: fc.integer({ min: 1, max: 3_000_000 }), ventaId: fc.option(fc.constantFrom(...ids, "anulada")) }), { maxLength: 6 }),
  });
  type Escenario = typeof escenario extends fc.Arbitrary<infer T> ? T : never;
  const armar = (e: Escenario) => {
    const ventas = e.ventas.map((v) => ({ id: v.id, clienteId: "c", dia: v.dia, orden: v.orden, importe: v.importe, ganancia: v.importe - v.costo }));
    const saldos: SaldoInicialCobro[] = e.saldos.map((s, i) => ({ id: `s${i}`, clienteId: "c", tipo: s.tipo, dia: s.dia, orden: i, importe: s.importe }));
    // Como en la base: el pago de una venta tiene la fecha de su venta.
    const pagos: PagoCobro[] = e.pagos.map((p, i) => {
      const v = ventas.find((x) => x.id === p.ventaId);
      return { id: `p${i}`, clienteId: "c", dia: v ? v.dia : p.dia, importe: p.importe, ventaId: p.ventaId ?? null };
    });
    return { ventas, saldos: saldos.filter((s) => s.importe > 0 || s.tipo === "deuda"), pagos };
  };

  it("lo cobrado de cada venta es igual que en la cuenta corriente (aplicarCreditos)", () => {
    fc.assert(
      fc.property(escenario, (e) => {
        const { ventas, saldos, pagos } = armar(e);
        const r = calcularGananciaCobrada(ventas, saldos, pagos);
        const deudas: Deuda[] = [
          ...ventas.map((v) => ({ id: v.id, tipo: "venta" as const, dia: v.dia, orden: v.orden, importe: v.importe })),
          ...saldos.filter((s) => s.tipo === "deuda").map((s) => ({ id: s.id, tipo: "saldo_inicial" as const, dia: s.dia, orden: s.orden, importe: s.importe })),
        ];
        const creditos = [...saldos.filter((s) => s.tipo === "a_favor" && s.importe > 0).map((s) => s.importe), ...pagos.map((p) => ({ importe: p.importe, ventaId: p.ventaId }))];
        const cuenta = aplicarCreditos(deudas, creditos);
        for (const d of cuenta.deudas) if (d.tipo === "venta" && d.importe > 0) expect(r.ventas.get(d.id)?.saldo).toBe(d.saldo);
      }),
    );
  });

  it("el desglose cierra cada día y la ganancia total es la de cada venta en proporción a lo cobrado", () => {
    fc.assert(
      fc.property(escenario, (e) => {
        const { ventas, saldos, pagos } = armar(e);
        const r = calcularGananciaCobrada(ventas, saldos, pagos);
        for (const d of r.dias) expect(d.cobrado - d.aPapel - d.quedoAFavor + d.aFavorUsado).toBe(d.costoCobrado + d.ganancia);
        const t = sumarDias(r.dias);
        expect(t.cobrado).toBe(pagos.reduce((s, p) => s + p.importe, 0));
        expect(t.ganancia).toBe([...r.ventas.values()].reduce((s, v) => s + v.gananciaCobrada, 0));
        expect(t.ganancia + r.gananciaPendiente).toBe(ventas.reduce((s, v) => s + v.ganancia, 0));
        for (const v of ventas) {
          const x = r.ventas.get(v.id)!;
          if (x.saldo === 0) expect(x.gananciaCobrada).toBe(v.ganancia); // pagada: toda su ganancia
          if (x.cobrado === 0 && v.importe > 0) expect(x.gananciaCobrada).toBe(0); // nada cobrado: nada de ganancia
        }
      }),
    );
  });

  it("no depende del orden de carga", () => {
    fc.assert(
      fc.property(escenario, (e) => {
        const { ventas, saldos, pagos } = armar(e);
        const a = calcularGananciaCobrada(ventas, saldos, pagos);
        const b = calcularGananciaCobrada([...ventas].reverse(), [...saldos].reverse(), [...pagos].reverse());
        expect(b.dias).toEqual(a.dias);
      }),
    );
  });
});
