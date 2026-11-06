# Decisiones técnicas — Módulo 1.0 (Base)

Cada decisión: qué se hizo, por qué y qué se descartó (regla 5 de CLAUDE.md).

## 1. Next.js 16 (App Router) + TypeScript + Tailwind 4
- **Por qué**: versión estable actual; las pantallas se arman en el servidor, así el celular descarga poco.
- **Descartado**: SPA pura (más JavaScript en el celular).

## 2. Sin `cacheComponents` (caché de componentes de Next 16)
- **Qué**: se desactivó la opción que trae activada la plantilla.
- **Por qué**: en una app de dinero cada pantalla debe mostrar los datos del momento. La caché agrega reglas
  (Suspense obligatorio, invalidaciones) que no aportan con 2 usuarios y pocos datos, y el riesgo es mostrar
  un saldo viejo.
- **Descartado**: mantenerla y cachear lecturas (más complejidad sin beneficio real).

## 3. Autenticación solo en el servidor, cookies `httpOnly`
- **Qué**: login con email y contraseña vía Supabase Auth, desde una acción de servidor. La sesión vive en una
  cookie que el JavaScript del navegador no puede leer, dura 400 días y se renueva sola (`src/proxy.ts`).
- **Por qué**: "sesión persistente y segura". Un script malicioso no puede robar la sesión.
- **Descartado**: cliente de Supabase en el navegador (obligaría a cookies legibles por JS).

## 4. Las claves de Supabase no llegan al navegador
- **Qué**: variables `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` **sin** prefijo `NEXT_PUBLIC_`; solo las lee el
  servidor. La clave secreta (`service_role`) no se usa en la app.
- **Por qué**: pedido explícito ("nunca en el frontend"). La clave pública es segura igual (la protege RLS), pero
  así ni siquiera se expone.

## 5. Registro público desactivado
- `enable_signup = false` (local en `supabase/config.toml`; en el proyecto real se configura en el panel).
  Las cuentas se crean a mano en Supabase y se vinculan a un socio con `supabase/admin/vincular-socio.sql`.
- Contraseñas de mínimo 10 caracteres con letras y números.

## 6. `socios` separado de las cuentas de login
- `socios.user_id` es opcional. El papá existe como socio aunque todavía no tenga cuenta (plan, A1).
- Un usuario logueado sin socio vinculado ve "Tu usuario no está habilitado" y nada más.

## 7. Seguridad en la base (RLS) con una sola regla
- `es_socio(negocio_id)`: el usuario solo ve filas de negocios de los que es socio.
- Además de RLS: el rol anónimo no tiene ningún permiso sobre tablas, y los permisos por defecto de tablas y
  funciones futuras arrancan cerrados (cada migración otorga lo justo).
- `socio_actual(negocio_id)` queda lista para que los próximos módulos completen "registrado_por" en la base,
  sin confiar en lo que mande el celular.
- **Pruebas**: `supabase/tests/00_base_rls.test.sql` (21 pruebas). Dos son generales y protegen a todos los
  módulos futuros: "toda tabla tiene RLS" y "el anónimo no tiene permisos sobre ninguna tabla".
  Se verificó que las pruebas fallan si se rompe una política.

## 8. Dinero en centavos enteros, también USD y tipo de cambio
- `src/lib/dinero.ts`: formato argentino, lectura de lo que escribe el usuario (rechaza "12.50" por ambiguo),
  conversión USD → pesos con redondeo al centavo mitad hacia arriba usando `BigInt` (sin errores de decimales).
- La base va a aplicar la misma fórmula al guardar compras (módulo 1.2); esta versión sirve para mostrar el
  resultado antes de confirmar.

## 9. Fechas en hora de Tucumán
- `src/lib/fechas.ts`: días como texto `AAAA-MM-DD`, calculados en `America/Argentina/Tucuman`.

## 10. Pruebas: Vitest + fast-check + pgTAP
- Vitest para lógica en TypeScript; fast-check genera miles de casos al azar (ya encontró un error en una
  prueba mal planteada del redondeo, que se corrigió).
- pgTAP con la base real de Supabase en Docker (`npx supabase test db`).
- GitHub Actions corre todo en cada PR (`.github/workflows/ci.yml`).

## 11. Ping anti-pausa adelantado al 1.0
- `ping()` en la base (devuelve solo la hora, la puede llamar el rol anónimo) y una tarea de GitHub Actions cada
  2 días (`.github/workflows/mantener-activo.yml`). Evita que el proyecto de prueba se pause durante el desarrollo.
  El backup diario y la exportación quedan para el módulo 1.9, como dice el plan.

## 12. Netlify
- `netlify.toml` con Node 22; Netlify detecta Next.js y usa su adaptador. Variables en el panel de Netlify.
