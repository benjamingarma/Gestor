import { describe, expect, it } from "vitest";
import { enSemana, esSemanaValida, finDeSemana, inicioDeSemana, nombreDeSemana } from "./semanas";
import { enPeriodo } from "@/dominio/resumen";

describe("semanas de domingo a sábado", () => {
  it("el inicio es el domingo (el domingo es su propio inicio, el sábado es el último día)", () => {
    expect(inicioDeSemana("2026-11-18")).toBe("2026-11-15"); // miércoles
    expect(inicioDeSemana("2026-11-15")).toBe("2026-11-15"); // domingo
    expect(inicioDeSemana("2026-11-21")).toBe("2026-11-15"); // sábado
    expect(inicioDeSemana("2026-11-22")).toBe("2026-11-22"); // domingo siguiente
    expect(finDeSemana("2026-11-15")).toBe("2026-11-21");
  });
  it("cruza meses y años", () => {
    expect(inicioDeSemana("2026-12-01")).toBe("2026-11-29");
    expect(inicioDeSemana("2027-01-02")).toBe("2026-12-27");
  });
  it("solo un domingo es una semana válida", () => {
    expect(esSemanaValida("2026-11-15")).toBe(true);
    expect(esSemanaValida("2026-11-16")).toBe(false);
    expect(esSemanaValida("2026-02-30")).toBe(false);
  });
  it("nombres", () => {
    expect(nombreDeSemana("2026-11-15")).toBe("15 al 21 de noviembre");
    expect(nombreDeSemana("2026-11-29")).toBe("29 de noviembre al 5 de diciembre");
    expect(nombreDeSemana("2026-12-27")).toBe("27 de diciembre de 2026 al 2 de enero de 2027");
  });
  it("enSemana y enPeriodo con semana", () => {
    expect(enSemana("2026-11-21", "2026-11-15")).toBe(true);
    expect(enSemana("2026-11-22", "2026-11-15")).toBe(false);
    expect(enPeriodo("2026-11-14", "sem-2026-11-15")).toBe(false);
    expect(enPeriodo("2026-11-15", "sem-2026-11-15")).toBe(true);
    expect(enPeriodo("2026-12-05", "sem-2026-11-29")).toBe(true);
  });
});
