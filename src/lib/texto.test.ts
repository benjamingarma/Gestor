import { describe, expect, it } from "vitest";
import { coincide, normalizar } from "./texto";

describe("búsqueda de texto", () => {
  it("ignora tildes y mayúsculas", () => {
    expect(normalizar("José Pérez")).toBe("jose perez");
    expect(coincide("José Pérez", "jose")).toBe(true);
  });
  it("todas las palabras, en cualquier orden", () => {
    expect(coincide("Vapex 8000", "8000 vap")).toBe(true);
    expect(coincide("Vapex 8000", "vapex 5000")).toBe(false);
  });
  it("búsqueda vacía coincide con todo", () => {
    expect(coincide("Ana", "  ")).toBe(true);
  });
});
