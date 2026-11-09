import { describe, expect, it } from "vitest";
import { esMesValido, mesDe, mesesEntre, nombreDelMes, rangoDelMes } from "./meses";

describe("meses", () => {
  it("rango del mes, incluido diciembre", () => {
    expect(rangoDelMes("2026-10")).toEqual(["2026-10-01", "2026-11-01"]);
    expect(rangoDelMes("2026-12")).toEqual(["2026-12-01", "2027-01-01"]);
    expect(() => rangoDelMes("2026-13")).toThrow(RangeError);
  });
  it("nombres en español", () => {
    expect(nombreDelMes("2026-10")).toBe("Octubre 2026");
    expect(nombreDelMes("2027-01")).toBe("Enero 2027");
  });
  it("meses entre dos fechas, del más nuevo al más viejo", () => {
    expect(mesesEntre("2026-11", "2027-02")).toEqual(["2027-02", "2027-01", "2026-12", "2026-11"]);
    expect(mesesEntre("2026-10", "2026-10")).toEqual(["2026-10"]);
    expect(mesesEntre("2026-11", "2026-10")).toEqual([]);
  });
  it("validación y mes de un día", () => {
    expect(esMesValido("2026-00")).toBe(false);
    expect(esMesValido("26-10")).toBe(false);
    expect(mesDe("2026-10-31")).toBe("2026-10");
  });
});
