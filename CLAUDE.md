# Juguetería El Arbolito — Proyecto Web

> Memoria del proyecto para Claude Code. Leer al inicio de cada sesión.
> La fuente de verdad de decisiones es `docs/09_DECISIONES_CONFIRMADAS.md`.

## Qué es
Tienda en línea para Juguetería El Arbolito (Culiacán, desde 1975) con sincronización de inventario contra el punto de venta físico Eleventa. Inventario único compartido entre tienda física y web.

## Stack
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Backend/DB: Supabase (PostgreSQL + Auth + Storage + Edge Functions) — project_id: nigxlspxlurdxvwnlffu
- Despliegue: Vercel
- Pagos: Mercado Pago (Checkout Pro)
- Facturación: la hace la tienda manualmente en físico (la web NO factura)
- Envíos: agregador multi-paquetería (Envía/Skydropx)
- Chatbot: fallback Groq → Gemini
- Agente de sincronización: Python (lee Firebird de Eleventa) en la PC de la tienda

## Reglas no negociables (resumen — ver docs/09)
- Las 8 categorías existentes NO se tocan (ya tienen fotos de sesión). Solo se mapean subcategorías.
- Todo producto entra `is_approved=false`; un admin lo aprueba antes de publicarlo.
- Productos agotados (`stock=0`) se OCULTAN del catálogo; reaparecen al haber stock.
- NO se ofrecen meses sin intereses (la tienda no absorbe esa comisión). Meses con intereses sí (los paga el cliente).
- NO hay devoluciones (se aclara en la web; sin módulo).
- Facturación: la tienda la hace manual en físico. La web solo marca si el cliente pidió factura (factura_solicitada). NO se integra Facturapi.
- Envíos a todo México, sin envío gratis. También recoger en tienda.
- El stock real vive en Eleventa. El agente SOLO LEE el archivo Firebird (PDVDATA.FDB); NUNCA escribe en él con Eleventa abierto (lo corrompería).
- Buffer de seguridad de stock para no sobrevender (config en sync_config).
- Cola offline persistente (SQLite) + idempotencia en el agente.
- Precio web = precio Eleventa, salvo `price_overridden=true` (el admin lo fijó manual).

## Datos del negocio
- Dirección: Mariano Escobedo 294-Poniente, Primer Cuadro, Centro, 80000 Culiacán Rosales, Sinaloa.
- Horario: Lun–Vie 10:00–18:30, Sáb 10:00–18:00.
- Redes: Instagram @elarbolitotoys, Facebook "Juguetería El Arbolito". Tema navideño.

## Estructura de repos
```
/web        Next.js (tienda + admin)
/agent      Agente Python de sincronización
/supabase   Migraciones y Edge Functions
/docs       Documentación (00–17)
```

## Estado actual
- Supabase: estructura aplicada (2 subcategorías nuevas en Deportes + columnas is_approved, approved_at, approved_by, price_overridden, category_id, subcategory_id en products). Tablas eleventa_catalog y products VACÍAS.
- Pendiente FASE 0: ejecutar `seed_inventario.sql` (2,395 productos).

## Estilo de código
- Código limpio, tipado (TypeScript estricto). Sin valores hardcodeados de color: usar tokens/variables (paleta azul/blanco tentativa, la dueña decide — ver docs/16).
- Comentarios y textos de usuario en español (México).
- Mensajes de error claros y accionables.

## Documentación (índice)
Leer `docs/00_README_PRINCIPAL.md`. Orden de construcción en `docs/08_PLAN_DE_IMPLEMENTACION.md`. Tooling en `docs/17_TOOLING_IDE.md`.

## Pendientes de la dueña (no bloquean fases 0-3)
Cuenta Mercado Pago, correo central, teléfono/correo público, logo en alta. Ver docs/13.
