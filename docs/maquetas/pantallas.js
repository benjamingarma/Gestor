// Maquetas del módulo 1.7 (datos inventados). Íconos propios dibujados a mano.
const I = {
  inicio: '<svg class="i" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>',
  clientes: '<svg class="i" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.3.2 3.9 1.7 4.4 4.3"/></svg>',
  vender: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  cobrar: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/></svg>',
  mas: '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  buscar: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
  cerrar: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  flecha: '<svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="m9 6 6 6-6 6"/></svg>',
  ok: '<svg viewBox="0 0 24 24" style="width:44px;height:44px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  stock: '<svg class="i" viewBox="0 0 24 24"><path d="M4 8 12 4l8 4v8l-8 4-8-4z"/><path d="m4 8 8 4 8-4M12 12v8"/></svg>',
  grafico: '<svg class="i" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  historial: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  caja: '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h14l-1 12H6z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  roto: '<svg class="i" viewBox="0 0 24 24"><path d="M6 4h12v16H6z"/><path d="m9 9 3 3-2 2 3 3"/></svg>',
  reparto: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 4"/></svg>',
  salir: '<svg class="i" viewBox="0 0 24 24"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>',
};

const navItems = [
  ["inicio", "Inicio"], ["clientes", "Clientes"], ["vender", "Vender"], ["cobrar", "Cobrar"], ["mas", "Más"],
];

function barraInferior(activo) {
  return `<nav class="barra">${navItems.map(([k, t]) =>
    k === "vender"
      ? `<div class="nav-vender"><span class="bola">${I.vender}</span><span>${t}</span></div>`
      : `<div class="nav-item ${k === activo ? "act" : ""}">${I[k]}<span>${t}</span></div>`).join("")}</nav>`;
}

const gestion = [
  ["stock", "Stock y productos"], ["caja", "Compras"], ["historial", "Historial de ventas"], ["historial", "Historial de cobros"],
  ["grafico", "Resumen y ganancia"], ["roto", "Regalos, pérdidas y roturas"], ["reparto", "Reparto entre socios"],
];

function barraLateral(activo) {
  const item = (k, t, icono = I[k]) => `<div class="lat-item ${k === activo ? "act" : ""}">${icono}<span>${t}</span></div>`;
  return `<aside class="lateral">
    <div class="marca" style="padding:6px 10px 18px"><span class="logo">MS</span><span style="font-size:1.15rem">McStock</span></div>
    <div class="lat-vender">${I.vender}<span>Vender</span></div>
    ${item("inicio", "Inicio")}${item("clientes", "Clientes")}${item("cobrar", "Cobrar")}
    <div class="mini suave fuerte" style="padding:18px 12px 6px;letter-spacing:.06em">GESTIÓN</div>
    ${gestion.map(([k, t]) => item("_", t, I[k])).join("")}
    <div style="margin-top:auto" class="lat-item">${I.salir}<span>Benjamín · salir</span></div>
  </aside>`;
}

// ------------------------------------------------------------------ Inicio
// Torta "de lo vendido, cuánto es costo y cuánto ganancia" (pedido del 11/11/2026).
// Dos porciones: ganancia de las ventas (vendido − costo) y costo de la mercadería. Números siempre escritos.
function torta(ganancia, costo, tam) {
  const total = ganancia + costo;
  const pg = (ganancia / total) * 100;
  const hueco = 0.8; // separación de 2px (aprox.) entre porciones, color de la tarjeta
  const arco = (desde, largo, clase) =>
    `<circle class="${clase}" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="${Math.max(largo - hueco, 0)} ${100 - Math.max(largo - hueco, 0)}" stroke-dashoffset="${-desde - hueco / 2}" transform="rotate(-90 50 50)"/>`;
  return `<svg class="torta" viewBox="0 0 100 100" width="${tam}" height="${tam}" role="img" aria-label="De $ 199.000 vendidos, $ 74.000 son ganancia de las ventas (37 %) y $ 125.000 costo de la mercadería (63 %)">
    ${arco(0, pg, "porcion-ganancia")}${arco(pg, 100 - pg, "porcion-costo")}
    <text x="50" y="46" text-anchor="middle" class="torta-chico">Vendido</text>
    <text x="50" y="59" text-anchor="middle" class="torta-num">$ 199.000</text>
  </svg>`;
}

const leyendaTorta = `
  <div class="col gap12" style="min-width:0">
    <div class="col gap4"><span class="fila" style="justify-content:flex-start;gap:8px"><span class="muestra muestra-ganancia"></span><span class="chico fuerte">Ganancia</span></span>
      <span class="medio num" style="padding-left:20px;white-space:nowrap">$ 74.000</span><span class="mini suave" style="padding-left:20px">37 % de lo vendido</span></div>
    <div class="col gap4"><span class="fila" style="justify-content:flex-start;gap:8px"><span class="muestra muestra-costo"></span><span class="chico fuerte">Costo de la mercadería</span></span>
      <span class="medio num" style="padding-left:20px;white-space:nowrap">$ 125.000</span><span class="mini suave" style="padding-left:20px">63 % · es capital para reponer</span></div>
  </div>`;

const cuentaTorta = `<span class="mini suave num">$ 199.000 vendido − $ 125.000 de costo = <b style="color:var(--texto)">$ 74.000 de ganancia</b>, se haya cobrado o no.</span>`;

const numerosMes = (pc) => `
    <div class="${pc ? "tres" : "col gap12"}">
      <div class="col gap4"><span class="suave chico">Vendido</span><span class="medio num">$ 199.000</span><span class="mini suave">12 ventas · 31 u</span></div>
      ${pc ? "" : '<div class="sep"></div>'}
      <div class="col gap4"><span class="suave chico">Cobrado</span><span class="medio num">$ 160.000</span><span class="mini suave">Benjamín $ 110.000 · Papá $ 50.000</span></div>
      ${pc ? "" : '<div class="sep"></div>'}
      <div class="col gap4"><span class="suave chico">Ganancia neta</span><span class="medio num acento">$ 67.000</span><span class="mini suave">$ 74.000 de ventas − $ 7.000 de pérdidas</span></div>
    </div>
    <div class="aviso"><span>ⓘ</span><span><b>La ganancia no es plata disponible.</b> Parte todavía nos la deben y el costo de la mercadería es capital para reponer.</span></div>`;

const inicioResumen = (pc) => pc ? `
  <div class="tarjeta col gap16">
    <div class="col gap4"><span class="titulo">Noviembre</span><span class="chico suave">De lo que se vendió, cuánto es costo y cuánto es ganancia</span></div>
    <div style="display:grid;grid-template-columns:auto 1fr 1.6fr;gap:28px;align-items:center">
      ${torta(74000, 125000, 168)}
      ${leyendaTorta}
      <div class="col gap12">${numerosMes(true)}</div>
    </div>
    ${cuentaTorta}
    <span class="enlace chico">Ver resumen completo ›</span>
  </div>` : `
  <div class="tarjeta col gap12">
    <div class="col gap4"><span class="titulo">Noviembre</span><span class="chico suave">De lo que se vendió, cuánto es costo y cuánto es ganancia</span></div>
    <div class="fila" style="justify-content:flex-start;gap:16px">${torta(74000, 125000, 136)}${leyendaTorta}</div>
    ${cuentaTorta}
    <div class="sep"></div>
    ${numerosMes(false)}
    <span class="enlace chico">Ver resumen completo ›</span>
  </div>`;

// Estados especiales de la sección (sin ventas, o ventas por debajo del costo): mensaje en vez de torta.
const resumenSinVentas = `
  <div class="tarjeta col gap12">
    <div class="col gap4"><span class="titulo">Noviembre</span><span class="chico suave">De lo que se vendió, cuánto es costo y cuánto es ganancia</span></div>
    <div class="vacio"><span class="fuerte">Todavía no hay ventas en noviembre.</span><span class="chico suave">El gráfico aparece con la primera venta del mes.</span></div>
    <div class="sep"></div>
    <div class="col gap12">
      <div class="col gap4"><span class="suave chico">Vendido</span><span class="medio num">$ 0</span><span class="mini suave">0 ventas · 0 u</span></div><div class="sep"></div>
      <div class="col gap4"><span class="suave chico">Cobrado</span><span class="medio num">$ 15.000</span><span class="mini suave">Papá $ 15.000</span></div><div class="sep"></div>
      <div class="col gap4"><span class="suave chico">Ganancia neta</span><span class="medio num acento">$ 0</span><span class="mini suave">$ 0 de ventas − $ 0 de pérdidas</span></div>
    </div>
    <div class="aviso"><span>ⓘ</span><span><b>La ganancia no es plata disponible.</b> Parte todavía nos la deben y el costo de la mercadería es capital para reponer.</span></div>
    <span class="enlace chico">Ver resumen completo ›</span>
  </div>`;
const resumenBajoCosto = `
  <div class="tarjeta col gap12">
    <div class="col gap4"><span class="titulo">Noviembre</span><span class="chico suave">De lo que se vendió, cuánto es costo y cuánto es ganancia</span></div>
    <div class="vacio"><span class="fuerte">Este mes se vendió por debajo del costo.</span><span class="chico suave num">Se vendió $ 12.000 y la mercadería costó $ 14.500: las ventas dieron $ 2.500 de pérdida.</span></div>
    <span class="mini suave" style="border:1px dashed var(--borde);border-radius:10px;padding:8px;text-align:center">(maqueta: debajo siguen Vendido, Cobrado, Ganancia neta y el aviso, igual que en el caso normal)</span>
    <span class="enlace chico">Ver resumen completo ›</span>
  </div>`;

const aVisitar = `
  <div class="tarjeta col gap8">
    <div class="fila"><span class="titulo">A visitar hoy</span><span class="chip pe">3</span></div>
    <div class="col lista">
      ${[["B", "Bruno", "Atrasado 3 días", "pe"], ["C", "Carla", "Le toca hoy", "av"], ["D", "Diego", "Atrasado 1 día", "pe"]].map(([a, n, e, c]) => `
      <div class="fila" style="padding:10px 0">
        <div class="fila" style="justify-content:flex-start"><span class="avatar">${a}</span><div class="col"><span class="fuerte">${n}</span><span class="chip ${c}" style="padding:2px 8px;font-size:.72rem;width:fit-content">${e}</span></div></div>
        <span class="boton chicob">Vender</span>
      </div>`).join("")}
    </div>
  </div>`;

const nosDeben = `
  <div class="tarjeta col gap8 deben">
    <span class="suave chico">Nos deben</span>
    <div class="fila"><span class="grande num peligro">$ 162.500</span><span class="boton chicob">Cobrar</span></div>
    <span class="chico suave">4 clientes · la deuda más vieja es de Ana (hace 35 días)</span>
  </div>`;

function inicioMovil() {
  return `<div class="pantalla">
    <div class="cab col gap8">
      <div class="fila"><span class="marca"><span class="logo">MS</span>McStock</span><span class="chico" style="opacity:.85">lunes 9 de noviembre</span></div>
      <span style="font-size:1.4rem;font-weight:750">Hola, Benjamín</span>
    </div>
    <div class="cuerpo col gap12" style="margin-top:-28px">
      ${nosDeben}${aVisitar}
      <div class="tarjeta fila"><span class="fuerte">Capital en mercadería</span><span class="col" style="align-items:flex-end"><span class="fuerte num">USD 94,00</span><span class="chico suave num">$ 135.500</span></span></div>
      ${inicioResumen(false)}
    </div>
    ${barraInferior("inicio")}
  </div>`;
}

function inicioPc() {
  return `<div class="pc">${barraLateral("inicio")}<main class="pc-main">
    <div class="fila"><div class="col"><span class="suave chico">lunes 9 de noviembre</span><span style="font-size:1.6rem;font-weight:800">Hola, Benjamín</span></div>
      <div class="buscador" style="width:320px;background:var(--superficie);border:1px solid var(--borde)">${I.buscar}<span>Buscar cliente o producto</span></div></div>
    <div class="pc-grid">
      <div class="col gap16">${nosDeben}
        <div class="tarjeta fila"><span class="fuerte">Capital en mercadería</span><span class="fila"><span class="fuerte num">USD 94,00</span><span class="suave num">$ 135.500</span></span></div>
      </div>
      <div class="col gap16">${aVisitar}
        <div class="tarjeta col gap8"><span class="titulo">Quién debe plata</span>
          <div class="col lista">${[["Bruno", "70.000"], ["Ana", "60.000"], ["Elena", "19.500"], ["Fabián", "13.000"]].map(([n, m]) => `<div class="fila" style="padding:9px 0"><span>${n}</span><span class="fuerte peligro num">$ ${m}</span></div>`).join("")}</div>
        </div>
      </div>
    </div>
    ${inicioResumen(true)}
  </main></div>`;
}

function estadosResumenMovil() {
  return `<div class="pantalla" style="background:var(--fondo)"><div class="cuerpo col gap16" style="padding-top:16px">
    <span class="chico suave fuerte">Sin ventas en el mes</span>${resumenSinVentas}
    <span class="chico suave fuerte">Vendido por debajo del costo</span>${resumenBajoCosto}
  </div></div>`;
}

// ------------------------------------------------------------------ Venta
const productos = [
  ["Vapex 8000", "Quedan 11", "$ 10.500", "precio especial", 2],
  ["Nubo 5000", "Quedan 13", "$ 8.000", "último que pagó", 1],
  ["Vapex 12000", "Quedan 6", "$ 14.000", "precio general", 0],
  ["Lumo 3000", "Quedan 20", "$ 6.500", "precio general", 0],
];
const filaProducto = ([n, s, p, o, q]) => `
  <div class="fila" style="padding:12px 0">
    <div class="col gap4"><span class="fuerte">${n}</span><span class="chico suave"><span class="${q ? "fuerte" : ""}" style="${q ? "color:var(--texto)" : ""}">${p}</span> · ${o}</span><span class="mini suave">${s}</span></div>
    ${q ? `<div class="stepper"><span class="paso">−</span><b class="num">${q}</b><span class="paso mas">+</span></div>` : `<span class="paso mas">+</span>`}
  </div>`;
const clienteElegido = `
  <div class="tarjeta fila" style="padding:12px 14px"><div class="fila" style="justify-content:flex-start"><span class="avatar">B</span><div class="col"><span class="fuerte">Bruno</span><span class="chico peligro">Debe $ 70.000</span></div></div><span class="enlace chico">Cambiar</span></div>`;
const totalVenta = `
  <div class="col gap4"><div class="fila"><span class="suave">3 productos</span><span class="grande num" style="font-size:1.8rem">$ 29.000</span></div>
  <span class="mini suave" style="text-align:right">Ganancia estimada $ 8.000 · costo $ 21.000 (USD 15)</span></div>`;

function ventaMovil() {
  return `<div class="pantalla">
    <div class="sup fila"><span style="font-size:1.25rem;font-weight:800">Nueva venta</span><span class="suave">${I.cerrar}</span></div>
    <div class="cuerpo col gap12" style="padding-bottom:190px">
      ${clienteElegido}
      <div class="buscador">${I.buscar}<span>Buscar producto</span></div>
      <div class="tarjeta col lista" style="padding:4px 16px">${productos.map(filaProducto).join("")}</div>
      <div class="fila chico suave" style="padding:0 4px"><span>Hoy · vendió Benjamín · sin nota</span><span class="enlace">Cambiar</span></div>
    </div>
    <div class="pie col gap12">${totalVenta}<span class="boton">Guardar venta</span></div>
  </div>`;
}

function ventaPc() {
  return `<div class="pc">${barraLateral("vender")}<main class="pc-main">
    <span style="font-size:1.6rem;font-weight:800">Nueva venta</span>
    <div class="pc-grid" style="grid-template-columns:1.5fr 1fr">
      <div class="col gap12">
        <div class="buscador" style="background:var(--superficie);border:1px solid var(--borde)">${I.buscar}<span>Buscar producto</span></div>
        <div class="tarjeta col lista" style="padding:4px 18px">${productos.concat([["Nubo 9000", "Quedan 4", "$ 12.000", "precio general", 0]]).map(filaProducto).join("")}</div>
      </div>
      <div class="col gap12">
        ${clienteElegido}
        <div class="tarjeta col gap12">
          <span class="titulo">Resumen</span>
          <div class="col gap8 chico">
            <div class="fila"><span>2 × Vapex 8000</span><span class="num">$ 21.000</span></div>
            <div class="fila"><span>1 × Nubo 5000</span><span class="num">$ 8.000</span></div>
          </div>
          <div class="sep"></div>${totalVenta}
          <div class="fila chico suave"><span>Hoy · vendió Benjamín · sin nota</span><span class="enlace">Cambiar</span></div>
          <span class="boton">Guardar venta</span>
        </div>
      </div>
    </div>
  </main></div>`;
}

// ------------------------------------------------------------------ Cobro
const formCobro = `
  <div class="tarjeta col gap8" style="align-items:center;padding:22px 16px">
    <span class="suave chico">¿Cuánto pagó?</span>
    <span class="num" style="font-size:2.6rem;font-weight:800;letter-spacing:-.03em">$ 50.000<span class="cursor"></span></span>
    <div class="fila" style="gap:8px"><span class="chip">Todo · $ 99.000</span><span class="chip">$ 20.000</span><span class="chip">$ 50.000</span></div>
  </div>
  <div class="col gap8"><span class="fuerte chico">¿Cómo pagó?</span>
    <div class="segmento" style="grid-template-columns:repeat(3,1fr)"><span class="opcion sel">Efectivo<span class="mini" style="font-weight:500">último usado</span></span><span class="opcion">Transferencia</span><span class="opcion">Mercado Pago</span></div></div>
  <div class="col gap8"><span class="fuerte chico">¿Quién recibió la plata?</span>
    <div class="segmento" style="grid-template-columns:1fr 1fr"><span class="opcion sel">Benjamín</span><span class="opcion">Papá</span></div></div>
  <div class="tarjeta fila" style="padding:12px 16px"><span class="suave chico">Le queda debiendo</span><span class="fuerte num peligro">$ 49.000</span></div>
  <div class="fila chico suave" style="padding:0 4px"><span>Hoy · sin nota</span><span class="enlace">Cambiar</span></div>`;
const clienteCobro = `
  <div class="tarjeta fila" style="padding:12px 14px"><div class="fila" style="justify-content:flex-start"><span class="avatar">B</span><div class="col"><span class="fuerte">Bruno</span><span class="chico peligro">Debe $ 99.000 · 3 ventas</span></div></div><span class="enlace chico">Cambiar</span></div>`;

function cobroMovil() {
  return `<div class="pantalla">
    <div class="sup fila"><span style="font-size:1.25rem;font-weight:800">Cobrar</span><span class="suave">${I.cerrar}</span></div>
    <div class="cuerpo col gap12" style="padding-bottom:110px">${clienteCobro}${formCobro}</div>
    <div class="pie"><span class="boton">Guardar cobro · $ 50.000</span></div>
  </div>`;
}

function cobroPc() {
  return `<div class="pc">${barraLateral("cobrar")}<main class="pc-main">
    <span style="font-size:1.6rem;font-weight:800">Cobrar</span>
    <div class="pc-grid" style="grid-template-columns:1fr 1.25fr">
      <div class="tarjeta col gap8"><div class="buscador">${I.buscar}<span>Buscar cliente</span></div>
        <span class="mini suave fuerte" style="padding-top:6px">LOS QUE MÁS DEBEN</span>
        <div class="col lista">${[["Bruno", "99.000", 1], ["Ana", "60.000", 0], ["Elena", "19.500", 0], ["Fabián", "13.000", 0]].map(([n, m, s]) => `<div class="fila" style="padding:10px 8px;border-radius:10px;${s ? "background:var(--acento-suave)" : ""}"><span class="${s ? "fuerte" : ""}">${n}</span><span class="fuerte peligro num">$ ${m}</span></div>`).join("")}</div>
      </div>
      <div class="col gap12">${clienteCobro}${formCobro}<span class="boton">Guardar cobro · $ 50.000</span></div>
    </div>
  </main></div>`;
}

// Elegir cliente para cobrar (paso previo en el celular)
function cobroListaMovil() {
  return `<div class="pantalla">
    <div class="sup col gap12"><span style="font-size:1.25rem;font-weight:800">Cobrar</span><div class="buscador">${I.buscar}<span>Buscar cliente</span></div></div>
    <div class="cuerpo col gap12">
      <span class="mini suave fuerte">NOS DEBEN · $ 191.500</span>
      <div class="tarjeta col lista" style="padding:4px 16px">${[["B", "Bruno", "99.000", "hace 12 días"], ["A", "Ana", "60.000", "hace 35 días"], ["E", "Elena", "19.500", "hace 5 días"], ["F", "Fabián", "13.000", "hace 2 días"]].map(([a, n, m, d]) => `
        <div class="fila" style="padding:11px 0"><div class="fila" style="justify-content:flex-start"><span class="avatar">${a}</span><div class="col"><span class="fuerte">${n}</span><span class="mini suave">deuda más vieja ${d}</span></div></div><span class="fuerte peligro num">$ ${m}</span></div>`).join("")}</div>
      <span class="chico suave" style="padding:0 4px">¿No debe pero paga por adelantado? Buscalo arriba: se le guarda a favor.</span>
    </div>
    ${barraInferior("cobrar")}
  </div>`;
}

// ------------------------------------------------------------------ Confirmación y Más
function guardadoMovil() {
  return `<div class="pantalla">
    <div class="sup fila"><span style="font-size:1.25rem;font-weight:800">Cobrar</span><span class="suave">${I.cerrar}</span></div>
    <div class="cuerpo col" style="align-items:center;justify-content:center;gap:16px;height:640px;text-align:center">
      <span class="check">${I.ok}</span>
      <span style="font-size:1.4rem;font-weight:800">Cobro guardado</span>
      <span class="grande num">$ 50.000</span>
      <span class="suave">Bruno · Efectivo · recibió Benjamín<br>Le queda debiendo <b class="peligro">$ 49.000</b></span>
      <div class="col gap8" style="width:100%;margin-top:18px"><span class="boton">Listo</span><span class="boton sec">Deshacer (anular)</span></div>
    </div>
  </div>`;
}

function masMovil() {
  const grupo = (titulo, items) => `<span class="mini suave fuerte" style="padding:8px 4px 0">${titulo}</span>
    <div class="tarjeta col lista" style="padding:2px 16px">${items.map(([k, t, d]) => `<div class="fila" style="padding:12px 0"><div class="fila" style="justify-content:flex-start;gap:14px"><span class="acento">${I[k]}</span><div class="col"><span class="fuerte">${t}</span>${d ? `<span class="mini suave">${d}</span>` : ""}</div></div><span class="suave">${I.flecha}</span></div>`).join("")}</div>`;
  return `<div class="pantalla">
    <div class="sup"><span style="font-size:1.25rem;font-weight:800">Más</span></div>
    <div class="cuerpo col gap8">
      ${grupo("NEGOCIO", [["grafico", "Resumen y ganancia", "Ganancia, cobrado, capital, reparto"], ["stock", "Stock y productos", "Precios, costo, cargar compras"], ["caja", "Compras", "En dólares, con tipo de cambio"]])}
      ${grupo("HISTORIAL Y CORRECCIONES", [["historial", "Ventas", "Ver y anular"], ["historial", "Cobros", "Ver y anular"], ["roto", "Regalos, pérdidas y roturas", "Dar de baja stock"]])}
      ${grupo("CONFIGURACIÓN", [["reparto", "Reparto entre socios", ""], ["salir", "Cerrar sesión", "benjamin@…"]])}
    </div>
    ${barraInferior("mas")}
  </div>`;
}

const MOVIL = { inicio: inicioMovil, "inicio-estados": estadosResumenMovil, venta: ventaMovil, "cobro-lista": cobroListaMovil, cobro: cobroMovil, guardado: guardadoMovil, mas: masMovil };
const PC = { inicio: inicioPc, venta: ventaPc, cobro: cobroPc };
