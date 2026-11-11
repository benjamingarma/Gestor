import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buscarDuplicado, limpiarNombre, MENSAJE_DUPLICADO, nombreParaComparar, problemaClienteNuevo, textoParaCrear } from "./clienteNuevo";

const clientes = [
  { id: "f", nombre: "Fabián" },
  { id: "c", nombre: "Carla Gómez" },
  { id: "z", nombre: "Zoe", archivado: true },
];

describe("nombre repetido (sin mayúsculas, tildes ni espacios de más)", () => {
  it("encuentra al existente con otra escritura", () => {
    for (const n of ["fabian", "FABIÁN", "  Fabián  ", "fabián"]) expect(buscarDuplicado(n, clientes)?.id).toBe("f");
    expect(buscarDuplicado("carla   GOMEZ", clientes)?.id).toBe("c");
  });
  it("también los archivados (la base tampoco deja repetirlos)", () => {
    expect(buscarDuplicado("zoe", clientes)).toEqual({ id: "z", nombre: "Zoe", archivado: true });
  });
  it("un nombre parecido no es duplicado (puede ser otra persona)", () => {
    expect(buscarDuplicado("Fabián Centro", clientes)).toBeNull();
    expect(buscarDuplicado("Carla", clientes)).toBeNull();
    expect(buscarDuplicado("   ", clientes)).toBeNull();
  });
  it("misma regla que nombre_para_comparar() de la base", () => {
    expect(nombreParaComparar("  Ñandú   PÉREZ ")).toBe("nandu perez");
    expect(nombreParaComparar("Joaquín  Gómez")).toBe("joaquin gomez");
  });
  it("propiedad: un nombre siempre choca consigo mismo con espacios de más, y en mayúsculas", () => {
    const letras = fc.stringMatching(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ ]{1,30}$/).filter((s) => s.trim() !== "");
    fc.assert(
      fc.property(letras, (n) => {
        const lista = [{ id: "x", nombre: n }];
        expect(buscarDuplicado(`  ${n}  `, lista)?.id).toBe("x");
        expect(buscarDuplicado(n.toUpperCase(), lista)?.id).toBe("x");
      }),
    );
  });
});

describe("opción Crear en el buscador", () => {
  it("ofrece lo escrito, limpio", () => {
    expect(textoParaCrear("  Hernán   Pérez ")).toBe("Hernán Pérez");
    expect(limpiarNombre(" a  b ")).toBe("a b");
  });
  it("no la ofrece si no hay nada escrito", () => {
    expect(textoParaCrear("")).toBeNull();
    expect(textoParaCrear("   ")).toBeNull();
  });
  it("corta en 80 caracteres", () => {
    expect(textoParaCrear("x".repeat(100))).toHaveLength(80);
  });
});

describe("validar el cliente nuevo antes de confirmarlo", () => {
  it("bien: nombre nuevo, teléfono opcional", () => {
    expect(problemaClienteNuevo({ nombre: "Hernán", telefono: "" }, clientes)).toBeNull();
    expect(problemaClienteNuevo({ nombre: "Hernán", telefono: "381 555-1234" }, clientes)).toBeNull();
  });
  it("nombre obligatorio y de hasta 80", () => {
    expect(problemaClienteNuevo({ nombre: "  ", telefono: "" }, clientes)?.tipo).toBe("nombre");
    expect(problemaClienteNuevo({ nombre: "x".repeat(81), telefono: "" }, clientes)?.tipo).toBe("nombre");
  });
  it("dirección opcional, de hasta 200", () => {
    expect(problemaClienteNuevo({ nombre: "Hernán", telefono: "", direccion: "San Martín 450" }, clientes)).toBeNull();
    expect(problemaClienteNuevo({ nombre: "Hernán", telefono: "", direccion: "" }, clientes)).toBeNull();
    expect(problemaClienteNuevo({ nombre: "Hernán", telefono: "", direccion: "x".repeat(201) }, clientes)?.tipo).toBe("direccion");
  });
  it("teléfono de hasta 40", () => {
    expect(problemaClienteNuevo({ nombre: "Hernán", telefono: "1".repeat(41) }, clientes)?.tipo).toBe("telefono");
  });
  it("duplicado: el mensaje de Nuevo cliente y el existente para ofrecer Usar a …", () => {
    expect(problemaClienteNuevo({ nombre: "fabian", telefono: "" }, clientes)).toEqual({
      tipo: "duplicado",
      mensaje: MENSAJE_DUPLICADO,
      existente: { id: "f", nombre: "Fabián" },
    });
  });
});
