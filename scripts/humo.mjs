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
  "/ventas", "/ventas/nueva", `/ventas/${ids.venta}`, "/cobros", "/resumen", "/resumen?mes=todo", "/resumen/reparto",
  "/mas", "/buscar?q=humo",
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
  console.log(`${ok ? "OK   " : "FALLA"} ${estado} ${ruta}`);
  if (!ok) errores.push(`${ruta} respondió ${estado}`);
}
// 3. Los mismos totales en todas las pantallas, y coinciden con la base (plan del módulo 1.7).
//    Cada pantalla marca sus totales con data-dato / data-centavos.
async function totales(ruta) {
  await pagina.goto(`${BASE}${ruta}`);
  return pagina.$$eval("[data-dato]", (els) =>
    Object.fromEntries(els.reverse().map((e) => [e.getAttribute("data-dato"), Number(e.getAttribute("data-centavos"))])),
  );
}
const enBase = (consulta) => Number(execFileSync("psql", [DB_URL, "-tAq", "-c", consulta]).toString().trim());
const mes = `date_trunc('month', public.hoy_tucuman())`;
const esperado = {
  "nos-deben": enBase(`select coalesce(sum(saldo), 0) from public.v_cuentas_clientes where negocio_id = '${NEGOCIO}' and saldo > 0`),
  "vendido-mes": enBase(`select coalesce(sum(importe), 0) from public.v_ventas where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', dia) = ${mes}`),
  "cobrado-mes": enBase(`select coalesce(sum(importe), 0) from public.pagos where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', fecha) = ${mes}`),
  "ganancia-neta-mes": enBase(`select (select coalesce(sum(ganancia), 0) from public.v_ventas where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', dia) = ${mes})
    - (select coalesce(sum(costo_total_ars), 0) from public.ajustes_stock where negocio_id = '${NEGOCIO}' and anulado_en is null and date_trunc('month', fecha) = ${mes})`),
  "capital-ars": enBase(`select stock_ars from public.v_capital where negocio_id = '${NEGOCIO}'`),
  "capital-usd": enBase(`select stock_usd from public.v_capital where negocio_id = '${NEGOCIO}'`),
};
const pantallas = { Inicio: "/", Resumen: "/resumen", Cobros: "/cobros", Ventas: "/ventas", Stock: "/productos" };
const vistos = {};
for (const [nombre, ruta] of Object.entries(pantallas)) vistos[nombre] = await totales(ruta);
let comparaciones = 0;
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
await navegador.close();

if (errores.length > 0) {
  console.error(`\nPrueba de humo con errores:\n- ${errores.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nPrueba de humo OK: ${rutas.length} pantallas y ${comparaciones} totales iguales a la base.`);
