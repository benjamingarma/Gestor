// Prueba de humo: levanta la app de verdad (contra la base local de Supabase), entra con un
// usuario de prueba y abre cada pantalla. Falla si alguna responde con error.
// Detecta problemas que las pruebas de lógica y de base no ven (por ejemplo, una consulta que la
// API de Supabase no puede resolver y deja a todos sin poder entrar).
//
// Requisitos: base local corriendo (npm run db:start), app compilada y corriendo en BASE_URL,
// psql disponible, y Playwright (en CI se instala en el paso anterior).
// Variables: BASE_URL, API_URL, SECRET_KEY, DB_URL (las de `npx supabase status -o env`).
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const { API_URL, SECRET_KEY } = process.env;
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const NEGOCIO = "11111111-1111-4111-8111-111111111111"; // supabase/seed.sql
if (!API_URL || !SECRET_KEY) throw new Error("Faltan API_URL y SECRET_KEY (npx supabase status -o env)");

const email = `humo-${Date.now()}@humo.test`;
const contrasena = randomBytes(12).toString("hex") + "A1";

// 1. Usuario de prueba vinculado al Socio A del seed (contraseña aleatoria, solo para esta corrida).
const r = await fetch(`${API_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: contrasena, email_confirm: true }),
});
if (!r.ok) throw new Error(`No se pudo crear el usuario: ${r.status} ${await r.text()}`);
const { id: userId } = await r.json();

const ids = { producto: randomUUID(), cliente: randomUUID(), compra: randomUUID(), venta: randomUUID(), pago: randomUUID(), ajuste: randomUUID() };
const sql = `
update public.socios set user_id = null where user_id is not null and negocio_id = '${NEGOCIO}' and orden = 1;
update public.socios set user_id = '${userId}' where negocio_id = '${NEGOCIO}' and orden = 1;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
insert into public.productos (id, negocio_id, marca, modelo, precio_general) values ('${ids.producto}', '${NEGOCIO}', 'Humo', '${Date.now()}', 1000000);
insert into public.clientes (id, negocio_id, nombre) values ('${ids.cliente}', '${NEGOCIO}', 'Cliente humo ${Date.now()}');
select public.registrar_compra('${ids.compra}', '${NEGOCIO}', '${ids.producto}', public.hoy_tucuman(), 5, 500, 140000);
select public.registrar_venta('${ids.venta}', '${NEGOCIO}', '${ids.cliente}', '[{"producto_id":"${ids.producto}","cantidad":2,"precio_unitario":1000000}]');
select public.registrar_pago('${ids.pago}', '${ids.cliente}', 500000, 'efectivo');
select public.registrar_ajuste('${ids.ajuste}', '${NEGOCIO}', '${ids.producto}', 1, 'rotura');
commit;`;
execFileSync("psql", [DB_URL, "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: ["ignore", "ignore", "inherit"] });

// 2. Recorrido por todas las pantallas.
const rutas = [
  "/", "/clientes", "/clientes/nuevo", `/clientes/${ids.cliente}`, `/clientes/${ids.cliente}/cuenta`, `/clientes/${ids.cliente}/cobrar`,
  "/productos", "/productos/nuevo", `/productos/${ids.producto}`, `/productos/${ids.producto}/ajuste`, "/ajustes", "/ajustes?mes=todo", "/compras", "/compras/nueva",
  "/ventas", "/ventas/nueva", `/ventas/nueva?cliente=${ids.cliente}`, `/ventas/${ids.venta}`, `/ventas/${ids.venta}/guardada`, "/cobros", "/resumen", "/resumen?mes=todo", "/resumen/reparto",
  "/mas", "/buscar?q=humo",
  "/cobrar", `/cobrar/${ids.cliente}`, `/cobrar/${ids.cliente}?importe=5.000&venta=${ids.venta}`, `/cobros/${ids.pago}/guardado`,
];
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({ ...devices["Pixel 7"] })).newPage();
const errores = [];
pagina.on("pageerror", (e) => errores.push(`error de JavaScript: ${e.message}`));

await pagina.goto(`${BASE}/login`);
await pagina.fill("input[name=email]", email);
await pagina.fill("input[name=contrasena]", contrasena);
await pagina.click("button[type=submit]");
await pagina.waitForURL(`${BASE}/`, { timeout: 20_000 });

for (const ruta of rutas) {
  const respuesta = await pagina.goto(`${BASE}${ruta}`);
  const estado = respuesta?.status() ?? 0;
  const texto = await pagina.textContent("body");
  const ok = estado < 400 && !/Application error|This page couldn.t load|Internal Server Error/i.test(texto ?? "");
  // Estilo (módulo 1.7): en el celular nada se sale del ancho de la pantalla (sin scroll horizontal).
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`${ok && desborde <= 0 ? "OK   " : "FALLA"} ${estado} ${ruta}${desborde > 0 ? ` (se sale ${desborde} px de ancho)` : ""}`);
  if (!ok) errores.push(`${ruta} respondió ${estado}`);
  if (desborde > 0) errores.push(`${ruta} se sale ${desborde} px del ancho del celular`);
}
// 3. Una venta de punta a punta con la pantalla nueva (módulo 1.7): + dos veces, guardar, confirmación y deshacer.
{
  const enBaseTexto = (consulta) => execFileSync("psql", [DB_URL, "-tAq", "-c", consulta]).toString().trim();
  await pagina.goto(`${BASE}/ventas/nueva?cliente=${ids.cliente}`);
  const nombre = (await pagina.locator("li", { has: pagina.locator(`button[aria-label^="Agregar Humo"]`) }).first().locator("span.font-bold").textContent())?.trim();
  await pagina.click(`button[aria-label="Agregar ${nombre}"]`);
  await pagina.click(`button[aria-label="Uno más de ${nombre}"]`);
  // La caja de precio viene con el sugerido ($ 10.000, precio general) y se tipea directo.
  const sugerido = await pagina.inputValue(`input[aria-label="Precio de ${nombre}"]`);
  if (sugerido !== "10.000") errores.push(`la caja de precio debería venir con 10.000 y vino con "${sugerido}"`);
  await pagina.fill(`input[aria-label="Precio de ${nombre}"]`, "12.000");
  await pagina.locator("button[type=submit]:visible", { hasText: "Guardar venta" }).click();
  await pagina.waitForURL(/\/ventas\/[0-9a-f-]{36}\/guardada$/, { timeout: 20_000 });
  const ventaId = pagina.url().split("/").at(-2);
  const guardada = enBaseTexto(`select importe || '|' || unidades from public.v_ventas where venta_id = '${ventaId}'`);
  const okVenta = guardada === "2400000|2" && (await pagina.getByRole("heading", { name: "Venta guardada" }).isVisible());
  console.log(`${okVenta ? "OK   " : "FALLA"} venta por la pantalla nueva: 2 u a $ 12.000 tipeado en la caja (sugerido ${sugerido}) = ${guardada}`);
  if (!okVenta) errores.push(`la venta por la pantalla nueva quedó como ${guardada} (se esperaba 2400000|2)`);
  await pagina.click("text=Deshacer (anular)");
  await pagina.fill("input[name=motivo]", "Prueba de humo");
  await pagina.click("text=Confirmar anulación");
  await pagina.waitForURL(/ok=anulada/, { timeout: 20_000 });
  const anulada = enBaseTexto(`select anulado_en is not null from public.ventas where id = '${ventaId}'`);
  console.log(`${anulada === "t" ? "OK   " : "FALLA"} deshacer desde la confirmación anula la venta`);
  if (anulada !== "t") errores.push("Deshacer no anuló la venta");
}

// 4. Los mismos totales en todas las pantallas, y coinciden con la base (plan del módulo 1.7).
//    Cada pantalla marca sus totales con data-dato / data-centavos.
//    Se comparan dos veces: con un cobro recién hecho por la pantalla de cobro y después de deshacerlo.
async function totales(ruta) {
  await pagina.goto(`${BASE}${ruta}`);
  return pagina.$$eval("[data-dato]", (els) =>
    Object.fromEntries(els.reverse().map((e) => [e.getAttribute("data-dato"), Number(e.getAttribute("data-centavos"))])),
  );
}
const enBase = (consulta) => Number(execFileSync("psql", [DB_URL, "-tAq", "-c", consulta]).toString().trim());
const mes = `date_trunc('month', public.hoy_tucuman())`;
let comparaciones = 0;
async function compararTotales(etiqueta) {
  const esperado = {
    "nos-deben": enBase(`select coalesce(sum(saldo), 0) from public.v_cuentas_clientes where negocio_id = '${NEGOCIO}' and saldo > 0`),
    "vendido-mes": enBase(`select coalesce(sum(importe), 0) from public.v_ventas where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', dia) = ${mes}`),
    "cobrado-mes": enBase(`select coalesce(sum(importe), 0) from public.pagos where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', fecha) = ${mes}`),
    "ganancia-neta-mes": enBase(`select (select coalesce(sum(ganancia), 0) from public.v_ventas where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', dia) = ${mes})
      - (select coalesce(sum(costo_total_ars), 0) from public.ajustes_stock where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', fecha) = ${mes})`),
    "capital-ars": enBase(`select stock_ars from public.v_capital where negocio_id = '${NEGOCIO}'`),
    "capital-usd": enBase(`select stock_usd from public.v_capital where negocio_id = '${NEGOCIO}'`),
  };
  const pantallas = { Inicio: "/", Resumen: "/resumen", "Pagos recibidos": "/cobros", Deudores: "/cobrar", Ventas: "/ventas", Stock: "/productos" };
  const vistos = {};
  for (const [nombre, ruta] of Object.entries(pantallas)) vistos[nombre] = await totales(ruta);
  console.log(`     totales ${etiqueta}:`);
  for (const [dato, valor] of Object.entries(esperado)) {
    const donde = Object.entries(vistos).filter(([, t]) => dato in t);
    if (donde.length < 2) errores.push(`"${dato}" aparece en menos de dos pantallas (${donde.map(([n]) => n).join(", ") || "ninguna"})`);
    for (const [nombre, t] of donde) {
      comparaciones++;
      if (t[dato] !== valor) errores.push(`${nombre} muestra ${dato} = ${t[dato]} y en la base es ${valor}`);
    }
    console.log(`${donde.every(([, t]) => t[dato] === valor) ? "OK   " : "FALLA"} ${dato} = ${valor} en ${donde.map(([n]) => n).join(", ")}`);
}
if (esperado["vendido-mes"] === 0) errores.push("la prueba de consistencia necesita al menos una venta este mes");
return esperado;
}

// 5. Un cobro de punta a punta con la pantalla nueva (módulo 1.7, PR 3): lista de quién debe → cobro →
//    confirmación → totales iguales en todas las pantallas → deshacer → totales de nuevo.
{
  const enBaseTexto = (consulta) => execFileSync("psql", [DB_URL, "-tAq", "-c", consulta]).toString().trim();
  const saldoEnBase = () => enBase(`select saldo from public.v_cuentas_clientes where cliente_id = '${ids.cliente}'`);
  const revisar = (ok, texto) => {
    console.log(`${ok ? "OK   " : "FALLA"} ${texto}`);
    if (!ok) errores.push(texto);
  };
  const saldoAntes = saldoEnBase(); // 2 u × $ 10.000 − $ 5.000 cobrados = $ 15.000
  const faltaCobrarEnVentas = async () => {
    await pagina.goto(`${BASE}/ventas`);
    return Number(await pagina.getAttribute("[data-falta-cobrar]", "data-falta-cobrar"));
  };
  const faltaAntes = await faltaCobrarEnVentas();
  await pagina.goto(`${BASE}/cobrar`);
  const fila = pagina.locator(`a[href="/cobrar/${ids.cliente}"]`).first();
  revisar((await fila.textContent())?.includes("$ 15.000") ?? false, `la lista de Deudores muestra al cliente de humo con su deuda ($ ${saldoAntes / 100})`);
  await fila.click();
  await pagina.waitForURL(new RegExp(`/cobrar/${ids.cliente}$`), { timeout: 20_000 });
  // Medio preseleccionado con el último cobro que registró este socio (el de la carga inicial: efectivo).
  revisar((await pagina.getAttribute('button[aria-pressed]:has-text("Efectivo")', "aria-pressed")) === "true", "Efectivo viene preseleccionado (último usado)");
  const queda = async () => Number(await pagina.getAttribute("[data-queda]", "data-queda"));
  await pagina.click("text=Todo · $ 15.000");
  revisar((await pagina.inputValue("#importe")) === "15.000" && (await queda()) === 0, "el botón Todo pone lo que debe y queda al día");
  await pagina.fill("#importe", "20.000");
  revisar((await queda()) === -500000 && (await pagina.getByText("Le quedan $ 5.000 a favor.").isVisible()), "si paga de más, avisa el saldo a favor en vivo ($ 5.000)");
  await pagina.fill("#importe", "4.000");
  revisar((await queda()) === saldoAntes - 400000, `Le queda debiendo en vivo: $ ${(saldoAntes - 400000) / 100}`);
  await pagina.locator("button[type=submit]:visible", { hasText: "Guardar pago · $ 4.000" }).click();
  await pagina.waitForURL(/\/cobros\/[0-9a-f-]{36}\/guardado$/, { timeout: 20_000 });
  const pagoId = pagina.url().split("/").at(-2);
  const guardado = enBaseTexto(`select importe || '|' || medio || '|' || (anulado_en is null) from public.pagos where id = '${pagoId}'`);
  revisar(guardado === "400000|efectivo|true", `cobro por la pantalla nueva guardado en la base: ${guardado}`);
  const mostrado = Number(await pagina.getAttribute("[data-saldo-cliente]", "data-saldo-cliente"));
  revisar(mostrado === saldoEnBase() && mostrado === saldoAntes - 400000 && (await pagina.getByRole("heading", { name: "Pago registrado" }).isVisible()), `la confirmación dice que le queda debiendo $ ${mostrado / 100}, igual que la base`);
  const conCobro = await compararTotales("con el cobro recién hecho");
  const faltaCon = await faltaCobrarEnVentas();
  revisar(faltaCon === faltaAntes - 400000, `Ventas: "De estas ventas, saldo pendiente" bajó $ 4.000 (${faltaAntes / 100} → ${faltaCon / 100})`);
  await pagina.goto(`${BASE}/cobros/${pagoId}/guardado`);
  await pagina.click("text=Deshacer (anular)");
  await pagina.fill("input[name=motivo]", "Prueba de humo");
  await pagina.click("text=Confirmar anulación");
  await pagina.getByRole("heading", { name: "Pago anulado" }).waitFor({ timeout: 20_000 });
  const anulado = enBaseTexto(`select anulado_en is not null from public.pagos where id = '${pagoId}'`);
  const despues = Number(await pagina.getAttribute("[data-saldo-cliente]", "data-saldo-cliente"));
  revisar(anulado === "t" && despues === saldoAntes, `deshacer desde la confirmación anula el cobro y la deuda vuelve a $ ${despues / 100}`);
  const sinCobro = await compararTotales("después de deshacer el cobro");
  const faltaSin = await faltaCobrarEnVentas();
  revisar(faltaSin === faltaAntes, `Ventas: "De estas ventas, saldo pendiente" volvió a $ ${faltaSin / 100} al deshacer`);
  revisar(conCobro["nos-deben"] === sinCobro["nos-deben"] - 400000 && conCobro["cobrado-mes"] === sinCobro["cobrado-mes"] + 400000, "el cobro movió exactamente $ 4.000 en Nos deben y en Cobrado del mes");
}
// 7. Repetir la última venta (maqueta 6): ficha → "Repetir última venta" → venta cargada con precios de hoy;
//    tarjeta "Última venta", "La última vez: $ X" cuando el precio de hoy es otro, y aviso si falta stock.
//    (Va antes de la sección 6, que deja el producto sin stock.)
{
  const revisar = (ok, texto) => {
    console.log(`${ok ? "OK   " : "FALLA"} ${texto}`);
    if (!ok) errores.push(texto);
  };
  const comoSocio = (sentencias) =>
    execFileSync("psql", [DB_URL, "-q", "-v", "ON_ERROR_STOP=1", "-c", `begin; set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true); ${sentencias} commit;`]);
  const visible = (sel) => pagina.locator(sel).filter({ visible: true }).first();
  // La última venta no anulada del cliente es la del paso 1 (2 u a $ 10.000); la del paso 3 se anuló.
  await pagina.goto(`${BASE}/clientes/${ids.cliente}`);
  await pagina.getByRole("link", { name: "Repetir última venta" }).click();
  await pagina.waitForURL(/\/ventas\/nueva\?cliente=.*repetir=1/, { timeout: 20_000 });
  const nombre = (await pagina.locator('button[aria-label^="Uno más de Humo"]').first().getAttribute("aria-label"))?.replace("Uno más de ", "");
  const cantidad = (await visible(`[aria-label="Cantidad de ${nombre}"]`).textContent())?.trim();
  const precio = await pagina.inputValue(`input[aria-label="Precio de ${nombre}"]`);
  const tarjeta = await visible(`[data-ultima-venta="${ids.venta}"]`).isVisible();
  const cargada = await visible("text=Cargada en la venta").isVisible();
  revisar(cantidad === "2" && precio === "10.000" && tarjeta && cargada, `desde la ficha: la venta viene cargada con la última (2 u, $ ${precio}, último que pagó) y la tarjeta "Última venta" (cantidad ${cantidad})`);

  // Precio especial nuevo ($ 9.000) y una unidad menos de stock: avisa "La última vez" y carga solo lo que hay.
  const ajuste = randomUUID();
  comoSocio(`select public.fijar_precio_especial('${ids.cliente}', '${ids.producto}', 900000);
    select public.registrar_ajuste('${ajuste}', '${NEGOCIO}', '${ids.producto}', 1, 'rotura');`);
  await pagina.goto(`${BASE}/ventas/nueva?cliente=${ids.cliente}`);
  const ultimaVez = await visible("[data-ultima-vez]").getAttribute("data-ultima-vez");
  revisar(ultimaVez === "1000000", `con precio especial distinto, el producto muestra "La última vez: $ 10.000" (${ultimaVez})`);
  await visible('button:has-text("Repetir esta venta")').click();
  const cant2 = (await visible(`[aria-label="Cantidad de ${nombre}"]`).textContent())?.trim();
  const precio2 = await pagina.inputValue(`input[aria-label="Precio de ${nombre}"]`);
  const falta = await visible("[data-faltantes]").textContent();
  revisar(cant2 === "1" && precio2 === "9.000" && /llevó 2, quedan 1/.test(falta ?? ""), `"Repetir esta venta" sin stock suficiente: carga 1 a $ ${precio2} (precio especial de hoy) y avisa (${falta?.trim()})`);
  // Se deja todo como estaba para la sección 6.
  comoSocio(`select public.anular_ajuste('${ajuste}', 'Prueba de humo');
    select public.fijar_precio_especial('${ids.cliente}', '${ids.producto}', null);`);
}

// 6. Venta a un cliente nuevo desde "Nueva venta" (registrar_venta_cliente_nuevo).
{
  const enBaseTexto = (consulta) => execFileSync("psql", [DB_URL, "-tAq", "-c", consulta]).toString().trim();
  const revisar = (ok, texto) => {
    console.log(`${ok ? "OK   " : "FALLA"} ${texto}`);
    if (!ok) errores.push(texto);
  };
  const visible = (sel) => pagina.locator(sel).filter({ visible: true }).first();
  const producto = (await pagina.goto(`${BASE}/ventas/nueva`), await pagina.locator("li", { has: pagina.locator('button[aria-label^="Agregar Humo"]') }).first().locator("span.font-bold").textContent())?.trim();
  const crearCliente = async (nombre, telefono = "", direccion = "") => {
    await visible('input[aria-label="Buscar cliente"]').fill(nombre);
    await visible(`button:has-text("como cliente nuevo")`).click();
    if (telefono) await visible('input[aria-label="Teléfono del cliente nuevo"]').fill(telefono);
    if (direccion) await visible('input[aria-label="Dirección del cliente nuevo"]').fill(direccion);
  };

  // La opción "Crear cliente nuevo" está arriba de la lista sin escribir nada (pedido de los socios).
  const primera = (await pagina.locator('ul:has(button:has-text("Crear cliente nuevo"))').filter({ visible: true }).first().locator("li").first().textContent())?.trim();
  revisar(primera === "+Crear cliente nuevo", `sin escribir nada, la primera opción de la lista de clientes es "Crear cliente nuevo" (${primera})`);

  // 6a. Cliente nuevo + venta, con un producto cargado ANTES de crear el cliente (no se pierde). Doble toque al guardar.
  const nombreNuevo = `Humo nuevo ${Date.now()}`;
  await pagina.click(`button[aria-label="Agregar ${producto}"]`);
  await crearCliente(nombreNuevo, "381 555-0000", "  San Martín   450 ");
  await visible('button:has-text("Listo")').click();
  revisar(await visible("text=Cliente nuevo").isVisible(), "la tarjeta muestra el cliente elegido como \"Cliente nuevo\"");
  const precio = await pagina.inputValue(`input[aria-label="Precio de ${producto}"]`);
  revisar(precio === "10.000", `el producto cargado antes sigue en la venta, con el precio general ($ ${precio})`);
  await pagina.locator("button[type=submit]:visible", { hasText: "Guardar venta" }).dblclick();
  await pagina.waitForURL(/\/ventas\/[0-9a-f-]{36}\/guardada$/, { timeout: 20_000 });
  const ventaId = pagina.url().split("/").at(-2);
  const creado = enBaseTexto(`select count(*) || '|' || coalesce(max(c.telefono), '') || '|' || coalesce(max(c.direccion), '') || '|' || bool_and(c.es_prueba)
    || '|' || (select count(*) from public.ventas v where v.cliente_id = max(c.id::text)::uuid) from public.clientes c where c.nombre = '${nombreNuevo}'`);
  revisar(creado === "1|381 555-0000|San Martín 450|true|1", `doble toque en Guardar: un solo cliente nuevo (con teléfono, dirección limpia, dato de prueba) y una sola venta (${creado})`);
  const clienteNuevoId = enBaseTexto(`select id from public.clientes where nombre = '${nombreNuevo}'`);
  await pagina.goto(`${BASE}/clientes/${clienteNuevoId}`);
  revisar(await pagina.getByText("San Martín 450").first().isVisible(), "la ficha del cliente nuevo muestra su dirección");
  await pagina.goto(`${BASE}/ventas/${ventaId}/guardada`);
  const deLaVenta = enBaseTexto(`select c.nombre from public.ventas v join public.clientes c on c.id = v.cliente_id where v.id = '${ventaId}'`);
  revisar(deLaVenta === nombreNuevo, "la venta quedó a nombre del cliente nuevo");

  // 6b. Nombre repetido escrito distinto: avisa y ofrece usar el existente.
  await pagina.goto(`${BASE}/ventas/nueva`);
  await crearCliente(nombreNuevo.toUpperCase());
  const aviso = await visible("text=Ya existe un cliente con ese nombre").isVisible();
  const listo = await visible('button:has-text("Listo")').isDisabled();
  await visible(`button:has-text("Usar a ${nombreNuevo}")`).click();
  const elegido = await visible("span.truncate.font-bold").textContent();
  revisar(aviso && listo && elegido?.trim() === nombreNuevo, "nombre repetido (en mayúsculas): avisa, no deja crearlo y \"Usar a …\" elige el existente");

  // 6c. La venta falla (el stock se agotó mientras se cargaba): no queda el cliente nuevo.
  await pagina.goto(`${BASE}/ventas/nueva`);
  const huerfano = `Humo huérfano ${Date.now()}`;
  await pagina.click(`button[aria-label="Agregar ${producto}"]`);
  await crearCliente(huerfano);
  await visible('button:has-text("Listo")').click();
  const quedan = Number(enBaseTexto(`select unidades from public.v_stock_productos where producto_id = '${ids.producto}'`));
  execFileSync("psql", [DB_URL, "-q", "-v", "ON_ERROR_STOP=1", "-c", `begin; set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
    select public.registrar_ajuste('${randomUUID()}', '${NEGOCIO}', '${ids.producto}', ${quedan}, 'regalo'); commit;`]);
  await pagina.locator("button[type=submit]:visible", { hasText: "Guardar venta" }).click();
  const error = await pagina.getByRole("alert").filter({ hasText: /stock/i }).first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
  const quedoCliente = enBaseTexto(`select count(*) from public.clientes where nombre = '${huerfano}'`);
  revisar(error && quedoCliente === "0", `venta que falla por falta de stock: muestra el error y no deja el cliente nuevo (clientes: ${quedoCliente})`);
}

await navegador.close();

if (errores.length > 0) {
  console.error(`\nPrueba de humo con errores:\n- ${errores.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nPrueba de humo OK: ${rutas.length} pantallas y ${comparaciones} totales iguales a la base.`);
