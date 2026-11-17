import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  armarRepeticion,
  cambiarCantidad,
  juntarRenglones,
  reproponerPrecios,
  resumirCarrito,
  textoFaltante,
  ultimoPrecioDistinto,
  type PreciosCliente,
  type ProductoVenta,
  type RenglonAnterior,
} from "./carrito";

// Escenario del plan (sección 6): P1 Vapex 8000 (C2: 18 u a $7.000 / USD 5), P2 Nubo 5000 (C3: 15 u a $4.500 / USD 3).
const P1: ProductoVenta = {
  id: "p1", nombre: "Vapex 8000", unidades: 18, precioGeneral: 1_000_000,
  compras: [{ compraId: "c2", fecha: "2026-10-01", secuencia: 2, disponible: 18, costoUnitarioArs: 700_000, costoUnitarioUsd: 500 }],
};
const P2: ProductoVenta = {
  id: "p2", nombre: "Nubo 5000", unidades: 15, precioGeneral: 800_000,
  compras: [{ compraId: "c3", fecha: "2026-10-02", secuencia: 3, disponible: 15, costoUnitarioArs: 450_000, costoUnitarioUsd: 300 }],
};
const SIN_PRECIO: ProductoVenta = { id: "p3", nombre: "Lumo 3000", unidades: 2, precioGeneral: null, compras: [{ compraId: "c9", fecha: "2026-10-03", secuencia: 9, disponible: 2, costoUnitarioArs: 100, costoUnitarioUsd: 1 }] };
const productos = new Map([P1, P2, SIN_PRECIO].map((p) => [p.id, p]));
const precios: PreciosCliente = { especiales: { bruno: { p1: 1_050_000 } }, ultimos: { ana: { p2: 750_000 } } };
const ctx = (clienteId: string) => ({ clienteId, productos, precios });

describe("carrito de la venta", () => {
  it("V2 del plan: Bruno, 3 × P1 (precio especial $10.500) + 2 × P2 (general $8.000) = $47.500, ganancia estimada $17.500", () => {
    let items = cambiarCantidad([], "p1", 1, ctx("bruno"));
    items = cambiarCantidad(items, "p1", 2, ctx("bruno"));
    items = cambiarCantidad(items, "p2", 1, ctx("bruno"));
    items = cambiarCantidad(items, "p2", 1, ctx("bruno"));
    expect(items.map((i) => [i.productoId, i.cantidad, i.precio, i.origen])).toEqual([
      ["p1", 3, "10.500", "especial"],
      ["p2", 2, "8.000", "general"],
    ]);
    const r = resumirCarrito(items, productos, true);
    expect(r).toMatchObject({ productos: 2, unidades: 5, importe: 4_750_000, costoArs: 3_000_000, costoUsd: 2_100, ganancia: 1_750_000, problema: null });
  });

  it("precio propuesto: especial, después el último que pagó, después el general", () => {
    expect(cambiarCantidad([], "p1", 1, ctx("bruno"))[0]).toMatchObject({ precio: "10.500", origen: "especial" });
    expect(cambiarCantidad([], "p2", 1, ctx("ana"))[0]).toMatchObject({ precio: "7.500", origen: "ultimo" });
    expect(cambiarCantidad([], "p1", 1, ctx("ana"))[0]).toMatchObject({ precio: "10.000", origen: "general" });
    expect(cambiarCantidad([], "p3", 1, ctx("ana"))[0]).toMatchObject({ precio: "", origen: "ninguno" });
  });

  it("al cambiar de cliente se vuelve a proponer el precio de cada renglón", () => {
    const deBruno = cambiarCantidad([], "p1", 2, ctx("bruno"));
    expect(reproponerPrecios(deBruno, "ana", productos, precios)[0]).toMatchObject({ cantidad: 2, precio: "10.000", origen: "general" });
  });

  it("más y menos: nunca pasa del stock; en 0 el renglón se quita", () => {
    let items = cambiarCantidad([], "p3", 5, ctx("ana"));
    expect(items[0].cantidad).toBe(2); // hay 2
    items = cambiarCantidad(items, "p3", 1, ctx("ana"));
    expect(items[0].cantidad).toBe(2);
    items = cambiarCantidad(items, "p3", -1, ctx("ana"));
    expect(items[0].cantidad).toBe(1);
    expect(cambiarCantidad(items, "p3", -1, ctx("ana"))).toEqual([]);
    expect(cambiarCantidad([], "p1", -1, ctx("ana"))).toEqual([]);
  });

  it("no se puede guardar sin cliente, sin productos o sin precio", () => {
    const items = cambiarCantidad([], "p1", 1, ctx("ana"));
    expect(resumirCarrito(items, productos, false).problema).toBe("Elegí el cliente.");
    expect(resumirCarrito([], productos, true).problema).toBe("Agregá al menos un producto.");
    expect(resumirCarrito(cambiarCantidad([], "p3", 1, ctx("ana")), productos, true).problema).toBe("Lumo 3000: Poné el precio.");
    expect(resumirCarrito([{ ...items[0], precio: "abc" }], productos, true).problema).toMatch(/^Vapex 8000: /);
  });

  it("si el stock cambió y no alcanza, avisa", () => {
    const items = [{ productoId: "p3", cantidad: 3, precio: "1.000", origen: "general" as const }];
    expect(resumirCarrito(items, productos, true).problema).toBe("Lumo 3000: no alcanza el stock.");
  });

  it("precio corregido a mano: el total usa el precio escrito", () => {
    const items = cambiarCantidad([], "p1", 2, ctx("ana")).map((i) => ({ ...i, precio: "9.999,50" }));
    expect(resumirCarrito(items, productos, true).importe).toBe(1_999_900);
  });

  it("propiedad: total = Σ cantidad × precio; ganancia = total − costo; unidades nunca pasan del stock", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ p: fc.constantFrom("p1", "p2"), d: fc.integer({ min: -5, max: 8 }) }), { maxLength: 30 }), (pasos) => {
        let items = pasos.reduce((acc, s) => cambiarCantidad(acc, s.p, s.d, ctx("bruno")), [] as ReturnType<typeof cambiarCantidad>);
        items = items.map((i) => i);
        const r = resumirCarrito(items, productos, true);
        for (const f of r.filas) expect(f.cantidad).toBeLessThanOrEqual(productos.get(f.productoId)!.unidades);
        expect(r.importe).toBe(r.filas.reduce((s, f) => s + f.cantidad * f.precioCentavos!, 0));
        expect(r.ganancia).toBe(r.importe - r.costoArs);
        expect(r.filas.every((f) => f.faltan === 0)).toBe(true);
      }),
    );
  });
});

describe("repetir la última venta", () => {
  const anterior = (productoId: string, cantidad: number, precioUnitario: number, nombre = productoId): RenglonAnterior => ({ productoId, nombre, cantidad, precioUnitario });

  it("mismos productos y cantidades con los precios de hoy (especial → último → general)", () => {
    const { items, faltantes } = armarRepeticion([anterior("p1", 2, 1_000_000), anterior("p2", 1, 800_000)], ctx("bruno"));
    expect(items.map((i) => [i.productoId, i.cantidad, i.precio, i.origen])).toEqual([
      ["p1", 2, "10.500", "especial"],
      ["p2", 1, "8.000", "general"],
    ]);
    expect(faltantes).toEqual([]);
  });

  it("si falta stock carga lo que hay y avisa; sin stock o sin vender no lo agrega", () => {
    const { items, faltantes } = armarRepeticion(
      [anterior("p3", 5, 100, "Lumo 3000"), anterior("p9", 2, 500_000, "Vapex 12000"), anterior("p1", 1, 1_000_000)],
      ctx("ana"),
    );
    expect(items.map((i) => [i.productoId, i.cantidad])).toEqual([["p3", 2], ["p1", 1]]);
    expect(faltantes).toEqual([
      { nombre: "Lumo 3000", llevo: 5, cargadas: 2 },
      { nombre: "Vapex 12000", llevo: 2, cargadas: 0 },
    ]);
    expect(faltantes.map(textoFaltante)).toEqual(["Lumo 3000: llevó 5, quedan 2 → cargamos 2.", "Vapex 12000: sin stock, no se agregó."]);
  });

  it("el mismo producto en dos renglones se junta (vale el precio del último renglón)", () => {
    const renglones = [anterior("p2", 2, 700_000), anterior("p2", 3, 750_000)];
    expect(juntarRenglones(renglones)).toEqual([anterior("p2", 5, 750_000)]);
    expect(armarRepeticion(renglones, ctx("ana")).items).toEqual([{ productoId: "p2", cantidad: 5, precio: "7.500", origen: "ultimo" }]);
  });

  it("'La última vez' solo si el precio propuesto de hoy es distinto", () => {
    const renglones = [anterior("p1", 2, 1_000_000), anterior("p2", 1, 800_000)];
    expect(ultimoPrecioDistinto(renglones, "p1", 1_050_000)).toBe(1_000_000);
    expect(ultimoPrecioDistinto(renglones, "p2", 800_000)).toBeNull();
    expect(ultimoPrecioDistinto(renglones, "p3", 100)).toBeNull();
    expect(ultimoPrecioDistinto(renglones, "p1", null)).toBe(1_000_000);
  });

  it("nunca pasa del stock ni de lo que llevó, y lo que falta cuadra (fast-check)", () => {
    const ids = ["p1", "p2", "p3", "p9"];
    fc.assert(
      fc.property(fc.array(fc.record({ p: fc.constantFrom(...ids), q: fc.integer({ min: 1, max: 40 }) }), { maxLength: 12 }), (lista) => {
        const renglones = lista.map((x) => anterior(x.p, x.q, 100));
        const { items, faltantes } = armarRepeticion(renglones, ctx("ana"));
        for (const id of ids) {
          const llevo = lista.filter((x) => x.p === id).reduce((s, x) => s + x.q, 0);
          const cargado = items.find((i) => i.productoId === id)?.cantidad ?? 0;
          const stock = productos.get(id)?.unidades ?? 0;
          expect(cargado).toBeLessThanOrEqual(Math.min(llevo, stock));
          expect(cargado).toBe(Math.min(llevo, stock));
          const falta = faltantes.find((f) => f.nombre === id);
          expect(Boolean(falta)).toBe(llevo > cargado);
          if (falta) expect(falta).toEqual({ nombre: id, llevo, cargadas: cargado });
        }
        expect(new Set(items.map((i) => i.productoId)).size).toBe(items.length);
        expect(items.every((i) => i.cantidad > 0)).toBe(true);
      }),
    );
  });
});
