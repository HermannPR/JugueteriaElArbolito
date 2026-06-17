# 01 — Arquitectura General

## Diagrama del Sistema Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NUBE (siempre online)                        │
│                                                                       │
│   ┌──────────────┐         ┌────────────────────────────────┐        │
│   │   VERCEL     │         │           SUPABASE             │        │
│   │              │         │                                │        │
│   │  Next.js 14  │◄───────►│  • PostgreSQL (catálogo,       │        │
│   │  - Tienda    │  API    │    órdenes, stock cloud)       │        │
│   │  - Admin     │         │  • Auth (admin + clientes)     │        │
│   │  - Checkout  │         │  • Storage (imágenes)          │        │
│   └──────┬───────┘         │  • Edge Functions (webhooks)   │        │
│          │                 └───────────────┬────────────────┘        │
│          │                                 │                          │
│          ▼                                 │                          │
│   ┌──────────────┐                         │                          │
│   │ MERCADO PAGO │                         │                          │
│   │  (pagos web) │                         │                          │
│   └──────────────┘                         │                          │
└────────────────────────────────────────────┼────────────────────────┘
                                              │  (REST / HTTPS)
                                              │  Sincronización cada 5 min
                                              │  + cola offline
┌─────────────────────────────────────────────┼────────────────────────┐
│                  PC DEL EVENTO (puede estar offline)                  │
│                                              │                         │
│   ┌────────────────────┐         ┌───────────▼──────────────┐         │
│   │     ELEVENTA       │         │   AGENTE DE SYNC (Python) │         │
│   │  (Punto de Venta)  │         │                           │         │
│   │                    │  lee    │  • Lee stock de Eleventa  │         │
│   │  PDVDATA.FDB       │◄────────│  • Empuja stock a cloud   │         │
│   │  (Firebird)        │ (solo   │  • Baja ventas online     │         │
│   │                    │ lectura)│  • Cola SQLite local      │         │
│   └────────────────────┘         │  • Servicio Windows       │         │
│                                  │    (autoarranque)         │         │
│                                  └───────────────────────────┘         │
└───────────────────────────────────────────────────────────────────────┘
```

## Decisiones Técnicas Justificadas

### ¿Por qué Next.js + Vercel?
- Ya era el stack de la versión anterior (continuidad).
- Renderizado del lado del servidor (SSR) → bueno para SEO de una tienda.
- Vercel despliega gratis/barato y se integra nativo con Next.js.

### ¿Por qué Supabase?
- Ya existe la base de datos del proyecto (no empezar de cero).
- PostgreSQL real (no un wrapper limitado).
- Auth, Storage y Edge Functions en un solo lugar.
- RLS (Row Level Security) ya activado en todas las tablas.

### ¿Por qué un agente en Python en la PC del evento?
- Eleventa guarda todo en un archivo Firebird local (`PDVDATA.FDB`).
- La única forma de leer ese inventario en tiempo real es desde la misma PC.
- Python tiene la librería `fdb` / `firebird-driver` para leer Firebird.
- Se empaqueta como servicio de Windows para que arranque solo al prender la PC.

### ¿Por qué offline-first si el internet es "confiable casi siempre"?
- "Casi siempre" ≠ "siempre". Una venta perdida = un cliente molesto + descuadre de inventario.
- El costo de diseñar la cola offline es bajo y el beneficio (cero ventas perdidas) es alto.

## Componentes a Construir

| Componente | Lenguaje/Framework | Dónde corre |
|-----------|-------------------|-------------|
| Tienda pública | Next.js / React | Vercel |
| Panel admin | Next.js / React | Vercel |
| API de checkout | Next.js API Routes / Edge Functions | Vercel / Supabase |
| Webhook de pagos | Supabase Edge Function | Supabase |
| Agente de sync | Python 3.11+ | PC del evento |
| Servicio Windows | `pywin32` / NSSM | PC del evento |

## Repositorios Sugeridos

```
arbolito/
├── web/                    # Next.js (tienda + admin)
├── agent/                  # Agente Python de sincronización
├── supabase/
│   ├── migrations/         # SQL de migraciones
│   └── functions/          # Edge Functions
└── docs/                   # Esta documentación
```
