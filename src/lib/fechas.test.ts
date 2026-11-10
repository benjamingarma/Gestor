import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { diaEnTucuman, diasEntre, esDiaValido, formatearDia, formatearDiaLargo, formatearFechaHora, hoy, sumarDias } from "./fechas";

describe("día en hora de Tucumán", () => {
  it("23:30 del 31/10 en Tucumán es octubre aunque en UTC ya sea noviembre", () => {
    expect(diaEnTucuman(new Date("2026-11-01T02:30:00Z"))).toBe("2026-10-31");
  });
  it("00:00 en Tucumán ya es el día siguiente", () => {
    expect(diaEnTucuman(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
  });
  it("hoy() usa la hora de Tucumán", () => {
    expect(hoy(new Date("2026-12-31T23:59:00-03:00"))).toBe("2026-12-31");
  });
  it("formatea fecha y hora locales", () => {
    expect(formatearFechaHora(new Date("2026-11-01T02:30:00Z"))).toBe("31/10/2026 23:30");
  });
});

describe("aritmética de días", () => {
  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-10-25", 14)).toBe("2026-11-08");
    expect(sumarDias("2026-12-25", 14)).toBe("2027-01-08");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29"); // bisiesto
  });
  it("días entre fechas", () => {
    expect(diasEntre("2026-10-15", "2026-10-29")).toBe(14);
    expect(diasEntre("2026-10-29", "2026-10-15")).toBe(-14);
  });
  it("sumar y restar los mismos días vuelve al mismo día", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2100-01-01"), noInvalidDate: true }),
        fc.integer({ min: -5000, max: 5000 }),
        (fecha, n) => {
          const dia = fecha.toISOString().slice(0, 10);
          expect(sumarDias(sumarDias(dia, n), -n)).toBe(dia);
          expect(diasEntre(dia, sumarDias(dia, n))).toBe(n);
        },
      ),
    );
  });
  it("valida fechas", () => {
    expect(esDiaValido("2026-02-29")).toBe(false);
    expect(esDiaValido("2026-13-01")).toBe(false);
    expect(esDiaValido("06/11/2026")).toBe(false);
    expect(esDiaValido("2026-11-06")).toBe(true);
    expect(() => sumarDias("2026-02-30", 1)).toThrow(RangeError);
  });
  it("formato dd/mm/aaaa", () => {
    expect(formatearDia("2026-11-06")).toBe("06/11/2026");
  });
});

describe("formatearDiaLargo", () => {
  it("día de la semana, número y mes, en español", () => {
    expect(formatearDiaLargo("2026-11-09")).toBe("lunes 9 de noviembre");
    expect(formatearDiaLargo("2026-12-31")).toBe("jueves 31 de diciembre");
  });
});
