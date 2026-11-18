import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { aCsv, celda, centavosACsv, escapar } from "./exportar";

describe("exportar a CSV", () => {
  it("montos en centavos con coma decimal y sin miles", () => {
    expect(centavosACsv(1_234_550)).toBe("12345,50");
    expect(centavosACsv(5)).toBe("0,05");
    expect(centavosACsv(0)).toBe("0,00");
    expect(centavosACsv(-500)).toBe("-5,00");
    expect(celda(123750, "tipo_cambio")).toBe("1237,50");
    expect(celda("799", "costo_unitario_usd")).toBe("7,99"); // bigint que llega como texto
  });
  it("lo que no es monto queda igual; sí/no; vacío para null", () => {
    expect(celda(12, "cantidad")).toBe("12");
    expect(celda(3, "secuencia")).toBe("3");
    expect(celda(true, "es_prueba")).toBe("sí");
    expect(celda(false, "activo")).toBe("no");
    expect(celda(null, "nota")).toBe("");
    expect(celda("2026-11-18", "fecha")).toBe("2026-11-18");
  });
  it("fechas y horas en hora de Tucumán", () => {
    expect(celda("2026-11-18T13:15:00+00:00", "creado_en")).toBe("2026-11-18 10:15:00");
    expect(celda("2026-11-18T02:00:00.123456+00:00", "fecha")).toBe("2026-11-17 23:00:00");
  });
  it("un texto que Excel tomaría como fórmula lleva un apóstrofo adelante", () => {
    expect(celda("=HYPERLINK(1)", "nombre")).toBe("'=HYPERLINK(1)");
    expect(celda("+54 381", "telefono")).toBe("'+54 381");
    expect(celda("-", "nota")).toBe("'-");
    expect(celda("Ana", "nombre")).toBe("Ana");
  });
  it("comillas solo si hace falta, duplicando las internas", () => {
    expect(escapar("Ana")).toBe("Ana");
    expect(escapar("Pérez; Juan")).toBe('"Pérez; Juan"');
    expect(escapar('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escapar("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });
  it("CSV con BOM, encabezado, separador ; y CRLF", () => {
    const csv = aCsv([{ nombre: "Ana; B", importe: 150000, es_prueba: true }]);
    expect(csv).toBe('﻿nombre;importe;es_prueba\r\n"Ana; B";1500,00;sí\r\n');
    expect(aCsv([], ["id", "nombre"])).toBe("﻿id;nombre\r\n");
  });
  it("propiedad: cualquier texto vuelve igual al leer el CSV (sin perder ; comillas ni saltos)", () => {
    const leer = (linea: string) => {
      const celdas: string[] = [];
      let i = 0;
      while (i <= linea.length) {
        if (linea[i] === '"') {
          let v = "";
          i++;
          for (;;) {
            if (linea[i] === '"' && linea[i + 1] === '"') { v += '"'; i += 2; }
            else if (linea[i] === '"') { i++; break; }
            else v += linea[i++];
          }
          celdas.push(v);
          i++;
        } else {
          const fin = linea.indexOf(";", i);
          celdas.push(linea.slice(i, fin === -1 ? linea.length : fin));
          i = fin === -1 ? linea.length + 1 : fin + 1;
        }
      }
      return celdas;
    };
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 5 }), (textos) => {
        const seguros = textos.map((t) => t.replace(/^[=+\-@]+/, "").replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, ""));
        expect(leer(seguros.map(escapar).join(";"))).toEqual(seguros);
      }),
    );
  });
});
