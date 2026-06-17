# 11 — Variables de Entorno y Setup

> Lista completa de credenciales y configuración que el sistema necesita. Reunir todo esto antes de la Fase 4.

---

## A. Web (Next.js en Vercel) — `.env.local`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://nigxlspxlurdxvwnlffu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # llave pública (cliente)
SUPABASE_SERVICE_ROLE_KEY=            # SOLO en backend, nunca en cliente

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=             # privado (servidor)
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=   # público (cliente)
MERCADOPAGO_WEBHOOK_SECRET=

# Facturación: NO aplica en la web (la tienda factura manualmente en físico)

# Envíos (agregador: Envia/Skydropx/Enviosperros)
SHIPPING_PROVIDER_API_KEY=
SHIPPING_ORIGIN_POSTAL_CODE=80000     # CP confirmado
SHIPPING_ORIGIN_ADDRESS=

# Imágenes (Google Custom Search)
GOOGLE_CSE_API_KEY=
GOOGLE_CSE_ENGINE_ID=

# Chatbot (fallback Groq -> Gemini)
GROQ_API_KEY=
GEMINI_API_KEY=
CHATBOT_MAX_MESSAGES_PER_SESSION=20

# Notificaciones
RESEND_API_KEY=
ADMIN_EMAIL=                          # correo central del negocio (ver doc 15)
# Los destinatarios adicionales de avisos se guardan en store_settings
# (notification_emails[], notification_whatsapp[]), editables desde /admin/configuracion
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
ADMIN_WHATSAPP_NUMBER=

# General
NEXT_PUBLIC_SITE_URL=https://...      # dominio de la tienda
```

---

## B. Agente de Sincronización (PC de la tienda) — `.env`

```bash
# Supabase (usa service_role porque escribe stock)
SUPABASE_URL=https://nigxlspxlurdxvwnlffu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Eleventa / Firebird
FIREBIRD_DB_PATH=C:\Archivos de Programa\AbarrotesPDV\db\PDVDATA.FDB
FIREBIRD_USER=SYSDBA
FIREBIRD_PASSWORD=                    # contraseña de Firebird (default suele ser masterkey)

# Configuración del agente
SYNC_INTERVAL_MINUTES=5
HEARTBEAT_INTERVAL_SECONDS=60
LOCAL_QUEUE_DB=agent_queue.db
LOG_FILE=agent.log
```

> ⚠️ La `SUPABASE_SERVICE_ROLE_KEY` da acceso total a la base. En la PC de la tienda debe estar en un `.env` con permisos restringidos y NUNCA subirse a ningún repositorio.

---

## C. Cuentas/Servicios a Crear

| Servicio | Para qué | Acción |
|----------|----------|--------|
| Mercado Pago | Pagos | Crear cuenta de vendedor, obtener credenciales de producción |
| Facturapi | CFDI 4.0 | Crear cuenta, subir CSD (certificados del SAT) |
| Agregador envíos | Cotizar/generar guías | Crear cuenta (Envia/Skydropx) |
| Google Cloud | Custom Search API | Crear proyecto, habilitar Custom Search, crear motor |
| Resend | Emails | Crear cuenta, verificar dominio |
| WhatsApp Business | Notificaciones | Configurar vía Meta o Twilio, aprobar plantillas |
| Vercel | Hosting web | Conectar repositorio |

---

## D. Datos del Negocio a Reunir

- [ ] Dirección fiscal y física exacta de la tienda en Culiacán.
- [ ] RFC y régimen fiscal de la juguetería.
- [ ] CSD del SAT (Certificado de Sello Digital) para facturar.
- [ ] Logo y datos de marca.
- [ ] Contraseña de la base Firebird de Eleventa.
- [ ] Número de WhatsApp para recibir avisos de órdenes.
- [ ] Política de envíos (¿envío gratis arriba de cierto monto?).
- [ ] Pesos de productos (al menos estimados por categoría).

---

## E. Pendiente Crítico de Datos: PESOS

El Excel de inventario NO incluye peso de los productos, y el cálculo de envío lo necesita. Plan:
1. Asignar un **peso estimado por categoría** como punto de partida (ej. Peluches 0.3kg, Carros eléctricos 15kg, Libros 0.4kg).
2. Refinar manualmente los productos más vendidos.
3. Permitir al admin editar el peso por producto en `/admin/productos/[id]`.
