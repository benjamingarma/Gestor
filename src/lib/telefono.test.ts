import { describe, expect, it } from "vitest";
import { enlaceLlamada, enlaceWhatsApp, numeroNacional } from "./telefono";

describe("numeroNacional / WhatsApp", () => {
  it.each([
    ["381 15 555-1234", "3815551234"],
    ["0381 155551234", "3815551234"],
    ["(0381) 15-555-1234", "3815551234"],
    ["3815551234", "3815551234"],
    ["381 555 1234", "3815551234"],
    ["555-1234", "3815551234"], // sin característica: Tucumán
    ["15 555 1234", "3815551234"],
    ["+54 9 381 555 1234", "3815551234"],
    ["+54 381 555 1234", "3815551234"],
    ["0054 9 381 5551234", "3815551234"],
    ["11 15 2345-6789", "1123456789"], // Buenos Aires
    ["011 2345-6789", "1123456789"],
    ["3863 15 412345", "3863412345"], // característica de 4 dígitos
  ])("%s -> %s", (texto, esperado) => {
    expect(numeroNacional(texto)).toBe(esperado);
    expect(enlaceWhatsApp(texto)).toBe(`https://wa.me/549${esperado}`);
  });

  it.each([[""], [null], ["123"], ["abc"], ["38155512345678"]])("no reconoce %s", (texto) => {
    expect(numeroNacional(texto)).toBeNull();
    expect(enlaceWhatsApp(texto)).toBeNull();
  });
});

describe("enlaceLlamada", () => {
  it("marca lo escrito, sin espacios ni guiones", () => {
    expect(enlaceLlamada("381 15 555-1234")).toBe("tel:381155551234");
    expect(enlaceLlamada("+54 9 381 555 1234")).toBe("tel:+5493815551234");
  });
  it("sin teléfono no hay enlace", () => {
    expect(enlaceLlamada(null)).toBeNull();
    expect(enlaceLlamada("12")).toBeNull();
  });
});
