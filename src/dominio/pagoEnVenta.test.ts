import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { aplicarCreditos, type Deuda } from "./cuentaCorriente";
import { comoQueda, importePagoTodo } from "./pagoEnVenta";

// Beto debe $ 10.000 de antes y compra hoy $ 20.000 (tabla de la decisión del 18/11/2026).
describe("Beto: deuda anterior $ 10.000, venta $ 20.000", () => {
  it('"Pagó todo" cobra solo la venta: $ 20.000; esta venta pagada, deuda anterior $ 10.000', () => {
    expect(importePagoTodo(1_000_000, 2_000_000)).toBe(2_000_000);
    expect(comoQueda(1_000_000, 2_000_000, 2_000_000)).toEqual({ cobrado: 2_000_000, ventaDebe: 0, deudaAnterior: 1_000_000, aFavor: 0, saldo: 1_000_000 });
  });
  it("Pago parcial $ 12.000: esta venta debe $ 8.000, deuda anterior $ 10.000", () => {
    expect(comoQueda(1_000_000, 2_000_000, 1_200_000)).toMatchObject({ ventaDebe: 800_000, deudaAnterior: 1_000_000, saldo: 1_800_000 });
  });
  it("Pago de $ 25.000: esta venta pagada y el sobrante baja la deuda anterior a $ 5.000", () => {
    expect(comoQueda(1_000_000, 2_000_000, 2_500_000)).toMatchObject({ ventaDebe: 0, deudaAnterior: 500_000, aFavor: 0, saldo: 500_000 });
  });
  it("Pago de $ 35.000: paga todo y le quedan $ 5.000 a favor", () => {
    expect(comoQueda(1_000_000, 2_000_000, 3_500_000)).toMatchObject({ ventaDebe: 0, deudaAnterior: 0, aFavor: 500_000, saldo: -500_000 });
  });
  it("Deuda: esta venta debe $ 20.000 y la anterior sigue en $ 10.000", () => {
    expect(comoQueda(1_000_000, 2_000_000, 0)).toMatchObject({ cobrado: 0, ventaDebe: 2_000_000, deudaAnterior: 1_000_000, saldo: 3_000_000 });
  });
});

describe("saldo a favor", () => {
  it('"Pagó todo" registra el total menos el saldo a favor', () => {
    expect(importePagoTodo(-300_000, 2_000_000)).toBe(1_700_000);
    expect(comoQueda(-300_000, 2_000_000, 1_700_000)).toMatchObject({ ventaDebe: 0, deudaAnterior: 0, aFavor: 0, saldo: 0 });
  });
  it('si el saldo a favor cubre toda la venta, "Pagó todo" no registra pago y le queda el resto a favor', () => {
    expect(importePagoTodo(-2_500_000, 2_000_000)).toBe(0);
    expect(comoQueda(-2_500_000, 2_000_000, 0)).toMatchObject({ ventaDebe: 0, aFavor: 500_000, saldo: -500_000 });
  });
  it("Deuda con saldo a favor: el saldo a favor se usa en la venta", () => {
    expect(comoQueda(-300_000, 2_000_000, 0)).toMatchObject({ ventaDebe: 1_700_000, aFavor: 0, saldo: 1_700_000 });
  });
  it("cliente al día o nuevo: Pagó todo = total", () => {
    expect(importePagoTodo(0, 2_000_000)).toBe(2_000_000);
  });
  it("rechaza valores inválidos", () => {
    expect(() => comoQueda(0, -1, 0)).toThrow(RangeError);
    expect(() => comoQueda(0, 100, 1.5)).toThrow(RangeError);
    expect(() => importePagoTodo(0.5, 100)).toThrow(RangeError);
  });
});

describe("propiedades (fast-check)", () => {
  const saldo = fc.integer({ min: -5_000_000, max: 5_000_000 });
  const total = fc.integer({ min: 0, max: 5_000_000 });
  const pago = fc.integer({ min: 0, max: 8_000_000 });

  it("el saldo después es el de antes + la venta − el pago, y nada queda negativo", () => {
    fc.assert(
      fc.property(saldo, total, pago, (s, t, p) => {
        const q = comoQueda(s, t, p);
        expect(q.saldo).toBe(s + t - p);
        for (const v of [q.ventaDebe, q.deudaAnterior, q.aFavor]) expect(v).toBeGreaterThanOrEqual(0);
        expect(q.ventaDebe).toBeLessThanOrEqual(t);
        expect(q.aFavor === 0 || q.ventaDebe + q.deudaAnterior === 0).toBe(true);
      }),
    );
  });

  it('"Pagó todo" deja la venta pagada y no toca la deuda anterior', () => {
    fc.assert(
      fc.property(saldo, total, (s, t) => {
        const q = comoQueda(s, t, importePagoTodo(s, t));
        expect(q.ventaDebe).toBe(0);
        expect(q.deudaAnterior).toBe(Math.max(0, s));
      }),
    );
  });

  it("coincide con la cuenta corriente guardada (aplicarCreditos con el pago imputado a la venta)", () => {
    fc.assert(
      fc.property(saldo, total, pago, (s, t, p) => {
        const deudas: Deuda[] = [{ id: "nueva", tipo: "venta", dia: "2026-11-18", orden: 9, importe: t }];
        const creditos: ({ importe: number; ventaId: string } | number)[] = [];
        if (s > 0) deudas.push({ id: "vieja", tipo: "venta", dia: "2026-10-01", orden: 1, importe: s });
        if (s < 0) creditos.push(-s);
        if (p > 0) creditos.push({ importe: p, ventaId: "nueva" });
        const c = aplicarCreditos(deudas, creditos);
        const q = comoQueda(s, t, p);
        expect(c.deudas.find((d) => d.id === "nueva")?.saldo).toBe(q.ventaDebe);
        expect(c.deudas.find((d) => d.id === "vieja")?.saldo ?? 0).toBe(q.deudaAnterior);
        expect(c.aFavor).toBe(q.aFavor);
      }),
    );
  });
});
