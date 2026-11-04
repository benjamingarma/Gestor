# CLAUDE.md — Reglas permanentes del proyecto

Sistema de gestión para un negocio de venta de vapers entre dos socios (Tucumán, Argentina).
App web mobile-first, en español, moneda: pesos argentinos (ARS).
Stack: Next.js + TypeScript, Supabase (PostgreSQL + Auth), hosting en Netlify.
El plan completo está en `docs/plan.md`.

## Reglas de trabajo (obligatorias)

1. **Siempre en ramas, nunca directo en la principal.**
   Todo cambio se hace en una rama propia y entra a `main` por pull request.
   No se hacen commits ni push directos a `main`.

2. **Un módulo por vez.**
   Se implementa un solo módulo/etapa del plan por vez. No se arranca la etapa
   siguiente hasta que la actual esté terminada, probada y aprobada por los socios.

3. **Pruebas automáticas obligatorias para toda lógica de dinero.**
   Ganancia, costos, deudas, saldos, pagos parciales, reparto entre socios y stock
   deben tener pruebas automáticas. Ningún cambio en esa lógica se mergea sin pruebas
   que lo cubran y que pasen. Las políticas de Row Level Security también se prueban.

4. **Nunca poner claves ni credenciales en el código.**
   Todo secreto va en variables de entorno (`.env.local`, que está en `.gitignore`,
   y la configuración de Netlify/Supabase). En el repo solo puede existir
   `.env.example` con nombres de variables y valores vacíos o inventados.
   Durante el desarrollo se usa un proyecto de Supabase de prueba con datos inventados,
   nunca datos reales de clientes.

5. **Explicar cada decisión técnica antes de implementarla.**
   Antes de escribir código para una decisión técnica relevante (librería, estructura
   de tablas, forma de calcular algo, etc.), explicar qué se va a hacer, por qué, y qué
   alternativas se descartaron. Las decisiones de negocio no se inventan: se preguntan.

## Convenciones técnicas

- Dinero: se maneja en **centavos como enteros** (nunca `float`) en TypeScript y en la base.
- Los IDs de ventas, pagos y movimientos son **UUID generados en el cliente**.
- El stock **nunca se guarda como un número que se pisa**: se calcula sumando movimientos.
- Ventas y pagos no se borran ni se editan: se **anulan** con un registro que lo compense.
- Precio y costo de cada venta se guardan como **copia histórica** en el momento de la venta.
- Zona horaria de referencia: `America/Argentina/Tucuman`.
- Textos de la interfaz en español rioplatense.
