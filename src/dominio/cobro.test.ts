import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { aplicarCreditos } from "./cuentaCorriente";
import { atajosDeCobro, despuesDelCobro, preseleccionDeCobro } from "./cobro";

const centavos = fc.integer({ min: 1, max: 100_000_000_000 }); // mismos límites que pagos.importe

describe("Le queda debiendo (en vivo)", () => {
  it("cuenta de Bruno del plan: debe $ 99.000, paga $ 50.000 → debe $ 49.000; paga $ 50.000 → $ 1.000 a favor", () => {
    expect(despuesDelCobro(9_900_000, 5_000_000)).toEqual({ tipo: "debe", monto: 4_900_000 });
    expect(despuesDelCobro(4_900_000, 5_000_000)).toEqual({ tipo: "a_favor", monto: 100_000 });
  });
  it("paga todo: queda al día", () => {
    expect(despuesDelCobro(9_900_000, 9_900_000)).toEqual({ tipo: "al_dia" });
  });
  it("pago adelantado de alguien que no debe: todo queda a favor", () => {
    expect(despuesDelCobro(0, 2_000_000)).toEqual({ tipo: "a_favor", monto: 2_000_000 });
    expect(despuesDelCobro(-100_000, 2_000_000)).toEqual({ tipo: "a_favor", monto: 2_100_000 });
  });
  it("rechaza importes que no son centavos enteros", () => {
    expect(() => despuesDelCobro(100, 1.5)).toThrow(RangeError);
    expect(() => despuesDelCobro(100, -1)).toThrow(RangeError);
    expect(() => despuesDelCobro(Number.NaN, 1)).toThrow(RangeError);
  });

  it("propiedad: coincide con la cuenta corriente real después de sumar el pago (mismo saldo que la base)", () => {
    fc.assert(
      fc.property(fc.array(centavos, { maxLength: 6 }), fc.array(centavos, { maxLength: 6 }), centavos, (ventas, pagos, nuevo) => {
        const deudas = ventas.map((importe, i) => ({ id: `v${i}`, tipo: "venta" as const, dia: "2026-10-01", orden: i, importe }));
        const antes = aplicarCreditos(deudas, pagos).saldo;
        const real = aplicarCreditos(deudas, [...pagos, nuevo]);
        const d = despuesDelCobro(antes, nuevo);
        const esperado = BigInt(antes) - BigInt(nuevo);
        expect(BigInt(real.saldo)).toBe(esperado);
        if (d.tipo === "debe") {
          expect(BigInt(d.monto)).toBe(esperado);
          expect(real.debe).toBe(d.monto);
        } else if (d.tipo === "a_favor") {
          expect(BigInt(-d.monto)).toBe(esperado);
          expect(real.aFavor).toBe(d.monto);
        } else {
          expect(esperado).toBe(0n);
          expect(real.debe + real.aFavor).toBe(0);
        }
      }),
    );
  });
});

describe("botones rápidos", () => {
  it("debe $ 99.000: Todo · $ 99.000, $ 20.000 y $ 50.000 (como la maqueta)", () => {
    expect(atajosDeCobro(9_900_000)).toEqual([
      { texto: "todo", centavos: 9_900_000 },
      { texto: "fijo", centavos: 2_000_000 },
      { texto: "fijo", centavos: 5_000_000 },
    ]);
  });
  it("si debe poco, no ofrece montos fijos mayores o iguales a la deuda", () => {
    expect(atajosDeCobro(3_000_000)).toEqual([{ texto: "todo", centavos: 3_000_000 }, { texto: "fijo", centavos: 2_000_000 }]);
    expect(atajosDeCobro(2_000_000)).toEqual([{ texto: "todo", centavos: 2_000_000 }]);
  });
  it("si no debe (o tiene a favor), no hay Todo", () => {
    expect(atajosDeCobro(0).map((a) => a.texto)).toEqual(["fijo", "fijo"]);
    expect(atajosDeCobro(-500).map((a) => a.texto)).toEqual(["fijo", "fijo"]);
  });
  it("propiedad: Todo es exactamente la deuda y ningún atajo deja saldo a favor si debe", () => {
    fc.assert(
      fc.property(centavos, (saldo) => {
        const a = atajosDeCobro(saldo);
        expect(a[0]).toEqual({ texto: "todo", centavos: saldo });
        for (const x of a) expect(despuesDelCobro(saldo, x.centavos).tipo).not.toBe("a_favor");
      }),
    );
  });
});

describe("medio y quién recibió preseleccionados", () => {
  const socios = [{ id: "b" }, { id: "p" }];
  it("con el último cobro que registró el socio", () => {
    expect(preseleccionDeCobro({ medio: "transferencia", recibido_por: "p" }, socios, "b")).toEqual({ medio: "transferencia", recibidoPor: "p" });
  });
  it("sin cobros anteriores: sin medio elegido y recibe el que carga", () => {
    expect(preseleccionDeCobro(null, socios, "b")).toEqual({ medio: null, recibidoPor: "b" });
  });
  it("si el que recibió ya no es socio del negocio, recibe el que carga", () => {
    expect(preseleccionDeCobro({ medio: "efectivo", recibido_por: "x" }, socios, "p")).toEqual({ medio: "efectivo", recibidoPor: "p" });
  });
});
