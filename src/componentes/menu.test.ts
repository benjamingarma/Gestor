import { describe, expect, it } from "vitest";
import { esPantallaCompleta, GESTION, GESTION_LATERAL, PRINCIPALES } from "./menu";

describe("estructura de navegación (maquetas aprobadas)", () => {
  it("barra inferior: Inicio, Clientes, (Vender), Cobrar y Más", () => {
    expect(PRINCIPALES.map((p) => p.texto)).toEqual(["Inicio", "Clientes", "Cobrar"]);
  });
  it("Más: tres grupos en el orden de la maqueta", () => {
    expect(GESTION.map((g) => `${g.grupo} / ${g.texto}`)).toEqual([
      "Negocio / Resumen y ganancia",
      "Negocio / Stock y productos",
      "Negocio / Compras",
      "Historial y correcciones / Ventas",
      "Historial y correcciones / Cobros",
      "Historial y correcciones / Regalos, pérdidas y roturas",
      "Configuración / Reparto entre socios",
    ]);
  });
  it("barra lateral de PC: grupo Gestión en el orden de la maqueta", () => {
    expect(GESTION_LATERAL.map((g) => g.texto)).toEqual([
      "Stock y productos", "Compras", "Historial de ventas", "Historial de cobros", "Resumen y ganancia", "Regalos, pérdidas y roturas", "Reparto entre socios",
    ]);
  });
  it("venta y cobro ocupan toda la pantalla del celular (sin barra inferior)", () => {
    expect(esPantallaCompleta("/ventas/nueva")).toBe(true);
    expect(esPantallaCompleta("/clientes/123/cobrar")).toBe(true);
    expect(esPantallaCompleta("/ventas/123/guardada")).toBe(true);
    expect(esPantallaCompleta("/clientes/123")).toBe(false);
    expect(esPantallaCompleta("/ventas")).toBe(false);
  });
  it("marca la sección activa", () => {
    const activo = (ruta: string) => [...PRINCIPALES, ...GESTION].filter((i) => i.activo(ruta)).map((i) => i.texto);
    expect(activo("/")).toEqual(["Inicio"]);
    expect(activo("/clientes/abc")).toEqual(["Clientes"]);
    expect(activo("/clientes/abc/cobrar")).toEqual(["Cobrar"]);
    expect(activo("/productos/abc/ajuste")).toEqual(["Stock y productos"]);
    expect(activo("/resumen/reparto")).toEqual(["Reparto entre socios"]);
  });
});
