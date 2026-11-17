// Vuelve a generar las imágenes de las maquetas (celular y PC, tema claro y oscuro).
// Uso: node docs/maquetas/renderizar.mjs   (necesita Playwright con Chromium)
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const dir = dirname(fileURLToPath(import.meta.url));
const img = join(dir, "imagenes");
const b = await chromium.launch();
for (const tema of ["light", "dark"]) {
  const n = tema === "light" ? "claro" : "oscuro";
  const m = await (await b.newContext({ viewport: { width: 2600, height: 1340 }, colorScheme: tema })).newPage();
  await m.goto(`file://${dir}/movil.html`);
  await m.screenshot({ path: join(img, `celular-${n}.png`), fullPage: true });
  for (const p of ["inicio", "venta", "venta-repetida", "cobro"]) {
    const pc = await (await b.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: tema })).newPage();
    await pc.goto(`file://${dir}/pc.html?p=${p}`);
    await pc.screenshot({ path: join(img, `pc-${p}-${n}.png`) });
  }
  const fondo = n === "claro" ? "#9aa5a0" : "#050706";
  const html = `<body style="margin:0;padding:20px;background:${fondo};display:flex;flex-direction:column;gap:20px;font:700 18px system-ui;color:#fff">` +
    ["inicio", "venta", "venta-repetida", "cobro"].map((s, i) => `<div>${i + 1} · ${s[0].toUpperCase() + s.slice(1)} en PC (${n})</div><img src="pc-${s}-${n}.png" style="width:1366px;border-radius:10px">`).join("") + "</body>";
  const tmp = join(img, `_junta-${n}.html`);
  writeFileSync(tmp, html);
  const j = await (await b.newContext({ viewport: { width: 1406, height: 800 } })).newPage();
  await j.goto(`file://${tmp}`);
  await j.screenshot({ path: join(img, `pc-${n}.png`), fullPage: true });
  (await import("node:fs")).unlinkSync(tmp);
}
await b.close();
console.log("Imágenes generadas en", img);
