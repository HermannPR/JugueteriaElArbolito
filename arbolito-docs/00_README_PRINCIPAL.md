# 🌳 Juguetería El Arbolito — Documentación Técnica del Proyecto

> **Propósito de este documento:** Este es el paquete de planeación completo para reconstruir la plataforma de Juguetería El Arbolito. Está escrito para ser entregado a un agente de código (Claude Opus 4.8 en un IDE) y a desarrolladores humanos. Cada documento es autocontenido.

---

## 📦 Índice de Documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 00 | `00_README_PRINCIPAL.md` | Este archivo. Visión general e índice. |
| 01 | `01_ARQUITECTURA_GENERAL.md` | Stack tecnológico, diagrama de sistema, decisiones técnicas. |
| 02 | `02_BASE_DE_DATOS.md` | Esquema completo de Supabase, tablas nuevas y rediseño. |
| 03 | `03_FRONTEND_PESTANAS.md` | Todas las pantallas/pestañas del sistema (web pública + admin). |
| 04 | `04_AGENTE_SINCRONIZACION.md` | El sistema de sync Eleventa ↔ Cloud (offline-first). |
| 05 | `05_GESTION_IMAGENES.md` | Cómo manejar imágenes de ~2,400 productos sin que explote. |
| 06 | `06_PAGOS.md` | Mercado Pago: integración y flujo. |
| 07 | `07_FLUJOS_COMPLETOS.md` | Diagramas de todos los flujos del sistema. |
| 08 | `08_PLAN_DE_IMPLEMENTACION.md` | Orden de construcción por fases. |
| 09 | `09_DECISIONES_CONFIRMADAS.md` | **Fuente de verdad** de todas las decisiones del cliente. |
| 10 | `10_ENVIOS_Y_FACTURACION.md` | Envíos (agregador) + facturación manual en tienda + notificaciones. |
| 11 | `11_VARIABLES_ENTORNO.md` | Todas las credenciales y setup necesario. |
| 12 | `12_MAPEO_CATEGORIAS.md` | Mapeo de los 36 departamentos Eleventa → categorías web. |
| 13 | `13_CUESTIONARIO_DUENA.md` | Preguntas para la dueña (respondidas + pendientes). |
| 14 | `14_CHATBOT.md` | Chatbot de atención con fallback Groq → Gemini. |
| 15 | `15_CORREO_E_INTEGRACIONES.md` | Correo central del negocio para todas las integraciones. |
| 16 | `16_DISENO_VISUAL.md` | Dirección de diseño y paleta (azul/blanco, abierto). |
| 17 | `17_TOOLING_IDE.md` | Plugins, skills, MCP y comandos para el IDE (Claude Code). |

> **IMPORTANTE para el agente del IDE:** Lee primero `09_DECISIONES_CONFIRMADAS.md`. Ese documento manda sobre cualquier otro si hay contradicción.

---

## 🎯 Resumen Ejecutivo

**Qué es:** Una tienda en línea (e-commerce) para una juguetería que también vende físicamente en eventos usando el punto de venta **Eleventa**.

**El reto central:** El inventario es **uno solo y compartido**. Lo que se vende en el evento físico debe reflejarse en la web, y lo que se vende en la web debe reflejarse en el evento — incluso cuando no hay internet.

**Estado actual del proyecto:**
- ✅ Base de datos Supabase ya existe con 12 tablas bien diseñadas
- ✅ Arquitectura de sincronización con Eleventa ya contemplada (`sync_config`, `sync_log`, `eleventa_catalog`)
- ✅ Inventario real: **2,395 productos** exportados de Eleventa (en Excel)
- ❌ Frontend perdido (hay que reconstruir)
- ❌ Agente de sincronización por construir
- ❌ Imágenes de productos por resolver (la mayoría no tiene)

**Datos clave confirmados:**
- POS físico: **Eleventa** (usa base de datos Firebird, archivo `PDVDATA.FDB`)
- Negocio: **tienda física permanente** en Culiacán, Sinaloa (el agente corre 24/7)
- Cajas simultáneas: **1 sola caja**
- Internet: **confiable casi siempre** (pero se diseña offline-first por seguridad)
- Pasarela de pago: **Mercado Pago** (acreditación a 14 días)
- Facturación: la hace **la tienda manualmente en físico** (la web no factura)
- Envíos: **por peso/zona** (agregador multi-paquetería) + recoger en tienda
- Promociones: **cupones y descuentos** desde el inicio
- Notificaciones: **Email + WhatsApp**

> Ver `09_DECISIONES_CONFIRMADAS.md` para la lista completa de las 17 decisiones tomadas.

---

## 🧱 Stack Tecnológico (resumen)

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Despliegue web | Vercel |
| Pagos | Mercado Pago Checkout Pro |
| Agente local | Python + servicio Windows (en la PC del evento) |
| POS físico | Eleventa (Firebird) — ya instalado |

---

## ⚠️ Principios de Diseño No Negociables

1. **Offline-first en el evento:** El agente debe sobrevivir cortes de internet y reinicios de la PC sin perder ventas.
2. **Nunca corromper Eleventa:** El agente lee el `.FDB` pero NUNCA escribe en él mientras Eleventa está abierto.
3. **Stock con buffer de seguridad:** La web nunca muestra el 100% del stock físico, para evitar sobreventa.
4. **Cola persistente:** Toda venta/cambio que no se pudo sincronizar se guarda en disco y se reintenta.
5. **Idempotencia:** Reenviar la misma operación dos veces no debe duplicar descuentos de stock.
