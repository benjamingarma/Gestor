import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sumarDias } from "@/lib/fechas";
import { compararParaVisitar, estadoVisita, hayQueVisitar, proximaVisita, ultimaActividad, type DatosVisitaCliente } from "./visitas";

const base: DatosVisitaCliente = {
  fechaAlta: "2026-10-01",
  intervaloDias: 14,
  ultimaVisita: null,
  ultimaVenta: null,
  ultimaVisitaInicial: null,
  archivado: false,
};

describe("próxima visita", () => {
  it("sin actividad: fecha de alta + intervalo", () => {
    expect(proximaVisita(base)).toBe("2026-10-15");
  });
  it("desde la última visita", () => {
    expect(proximaVisita({ ...base, ultimaVisita: "2026-10-20" })).toBe("2026-11-03");
  });
  it("desde la última venta si es más reciente que la visita", () => {
    expect(proximaVisita({ ...base, ultimaVisita: "2026-10-20", ultimaVenta: "2026-10-25" })).toBe("2026-11-08");
  });
  it("la visita gana si es más reciente que la venta", () => {
    expect(proximaVisita({ ...base, ultimaVisita: "2026-10-28", ultimaVenta: "2026-10-25" })).toBe("2026-11-11");
  });
  it("desde la visita inicial (del papel) si no hay nada más nuevo", () => {
    expect(proximaVisita({ ...base, ultimaVisitaInicial: "2026-09-25" })).toBe("2026-10-09");
  });
  it("la visita inicial no gana sobre una visita más nueva", () => {
    expect(ultimaActividad({ ...base, ultimaVisitaInicial: "2026-09-25", ultimaVisita: "2026-10-02" })).toBe("2026-10-02");
  });
  it("respeta intervalos distintos", () => {
    expect(proximaVisita({ ...base, intervaloDias: 7, ultimaVisita: "2026-12-28" })).toBe("2027-01-04");
    expect(proximaVisita({ ...base, intervaloDias: 1, ultimaVisita: "2026-10-31" })).toBe("2026-11-01");
  });
  it("rechaza intervalos inválidos", () => {
    expect(() => proximaVisita({ ...base, intervaloDias: 0 })).toThrow(RangeError);
    expect(() => proximaVisita({ ...base, intervaloDias: 1.5 })).toThrow(RangeError);
  });
});

describe("estado: atrasado desde el día siguiente a la fecha prevista", () => {
  const cliente = { ...base, ultimaVisita: "2026-10-20" }; // próxima: 03/11
  it.each([
    ["2026-10-30", { tipo: "al_dia", proxima: "2026-11-03", diasFaltan: 4 }],
    ["2026-10-31", { tipo: "pronto", proxima: "2026-11-03", diasFaltan: 3 }],
    ["2026-11-02", { tipo: "pronto", proxima: "2026-11-03", diasFaltan: 1 }],
    ["2026-11-03", { tipo: "hoy", proxima: "2026-11-03" }],
    ["2026-11-04", { tipo: "atrasado", proxima: "2026-11-03", diasAtraso: 1 }],
    ["2026-11-10", { tipo: "atrasado", proxima: "2026-11-03", diasAtraso: 7 }],
  ])("hoy %s", (hoy, esperado) => {
    expect(estadoVisita(cliente, hoy)).toEqual(esperado);
  });

  it("un archivado nunca está atrasado", () => {
    expect(estadoVisita({ ...cliente, archivado: true }, "2027-01-01")).toEqual({ tipo: "archivado" });
    expect(hayQueVisitar({ tipo: "archivado" })).toBe(false);
  });

  it("marcar visitado hoy deja al cliente al día por todo el intervalo", () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 365 }), fc.integer({ min: 0, max: 400 }), (intervalo, atraso) => {
        const hoy = sumarDias("2026-11-09", 0);
        const atrasado = { ...base, intervaloDias: intervalo, ultimaVisita: sumarDias(hoy, -(intervalo + atraso)) };
        expect(estadoVisita(atrasado, hoy).tipo).toBe(atraso === 0 ? "hoy" : "atrasado");
        const visitado = { ...atrasado, ultimaVisita: hoy };
        expect(estadoVisita(visitado, hoy)).toEqual({ tipo: "al_dia", proxima: sumarDias(hoy, intervalo), diasFaltan: intervalo });
      }),
    );
  });
});

describe("orden de la lista A visitar", () => {
  it("más atrasado primero, después hoy, después el más cercano", () => {
    const estados = [
      { tipo: "pronto", proxima: "2026-11-12", diasFaltan: 3 },
      { tipo: "atrasado", proxima: "2026-11-07", diasAtraso: 2 },
      { tipo: "hoy", proxima: "2026-11-09" },
      { tipo: "pronto", proxima: "2026-11-10", diasFaltan: 1 },
      { tipo: "atrasado", proxima: "2026-10-30", diasAtraso: 10 },
    ] as const;
    const ordenados = [...estados].sort(compararParaVisitar);
    expect(ordenados.map((e) => e.tipo)).toEqual(["atrasado", "atrasado", "hoy", "pronto", "pronto"]);
    expect(ordenados[0]).toMatchObject({ diasAtraso: 10 });
    expect(ordenados[3]).toMatchObject({ diasFaltan: 1 });
  });
});
