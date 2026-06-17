# 09 — Decisiones Confirmadas del Cliente

> Este documento consolida TODAS las decisiones tomadas. Es la fuente de verdad para resolver cualquier ambigüedad en los demás documentos. Si algo en los docs 00-08 contradice esto, **manda este documento**.

---

## Tabla Maestra de Decisiones

| # | Tema | Decisión Final |
|---|------|----------------|
| 1 | **Tipo de negocio físico** | Tienda física **permanente** en Culiacán, Sinaloa (NO eventos temporales) |
| 2 | **POS físico** | Eleventa (Firebird, `PDVDATA.FDB`) |
| 3 | **Cajas simultáneas** | 1 sola caja |
| 4 | **Internet en tienda** | Confiable casi siempre (igual se diseña offline-first) |
| 5 | **Pasarela de pago** | Mercado Pago Checkout Pro |
| 6 | **Acreditación MP** | A 14 días (menor comisión) |
| 7 | **Pago OXXO** | Reservar stock 3 días; liberar si no paga |
| 8 | **Envíos** | Cálculo por peso/zona + recoger en tienda |
| 9 | **Paquetería** | Agregador multi-paquetería (Envía.com / Skydropx / Enviosperros) |
| 10 | **Facturación** | ~~Facturapi en la web~~ → La tienda factura MANUALMENTE en físico. La web NO integra facturación ni captura datos fiscales. El cliente que quiera factura la solicita por WhatsApp/correo |
| 11 | **Precio web** | Igual a Eleventa, con opción de cambiarlo manualmente por producto |
| 12 | **Sincronización de precios** | El stock SÍ se sincroniza; el precio NO automático (admin decide) |
| 13 | **Promociones** | Sí, motor de cupones y descuentos desde el inicio |
| 14 | **Notificaciones de órdenes** | Email + WhatsApp |
| 15 | **Productos a granel** | No, todo por pieza |
| 16 | **Búsqueda de imágenes** | Google Custom Search API |
| 17 | **Cuentas de cliente** | Sí, los clientes crean cuenta (también permitir invitado) |
| 18 | **Carga inicial de inventario** | Híbrida: seed del Excel + el agente reconcilia con Eleventa real al conectarse |
| 19 | **Facturación** | La hace la tienda manualmente en físico (fuera de la web). No hay módulo de facturación en línea |
| 20 | **Zona de envío** | A todo México; sin envío gratis (cliente paga según peso/zona) |
| 21 | **Horario tienda** | Lun–Vie 10:00–18:30, Sáb 10:00–18:00 (domingo cerrado) |
| 22 | **Empaque de pedidos** | Los trabajadores de la tienda |
| 23 | **Aprobación de productos** | Un admin aprueba cada producto antes de que aparezca en línea |
| 24 | **Promociones** | Por ahora solo oferta por artículo (precio tachado). Temporada más adelante |
| 25 | **Devoluciones** | NO hay devoluciones (se aclara la política en la web; sin módulo) |
| 26 | **Chatbot** | Sí, con fallback Groq → Gemini → mensaje fijo (ver doc 14) |
| 27 | **Recibo** | Al final: "¿Tienes preguntas?" → redirige a chatbot y contacto |
| 28 | **Redes/marca** | Instagram @elarbolitotoys, Facebook "Juguetería El Arbolito", tema navideño 🎄 |
| 29 | **Dirección tienda** | Mariano Escobedo 294-Poniente, Primer Cuadro, Centro, 80000 Culiacán Rosales, Sinaloa (CP 80000) |
| 30 | **Video institucional** | YouTube: juguetes de la tienda (https://www.youtube.com/watch?v=w0o04umwA_c) — opcional en página Nosotros |
| 31 | **Carga inicial DB** | Estructura lista en Supabase (2 subcats nuevas + columnas). Datos: el IDE ejecuta seed_inventario.sql (2,395 productos) |
| 32 | **Correo central** | Se creará un correo del negocio para TODAS las integraciones y avisos; se pueden agregar correos del personal (ver doc 15) |
| 33 | **Productos agotados** | Se OCULTAN del catálogo cuando stock=0; reaparecen al haber stock |
| 34 | **Tono chatbot** | Amigable pero formal |
| 35 | **Escalamiento chatbot** | Botón "Enviar mensaje por WhatsApp" cuando no puede ayudar |
| 36 | **Meses sin intereses** | NO se ofrecen MSI (le cuestan a la tienda). Se permiten meses CON intereses (los paga el cliente vía su banco); ver doc 06 |
| 37 | **Colores web** | Tentativo azul + blanco, ABIERTO a propuesta más pulida; la dueña decide (ver doc 16) |
| 38 | **Cuenta Mercado Pago** | NO existe aún; se creará con el correo central |

---

## Decisiones AÚN Pendientes (cuestionario a la dueña)

Ver `13_CUESTIONARIO_DUENA.md`. Pendientes bloqueantes que la dueña debe entregar:
- **WhatsApp + correo de avisos de órdenes** (bloquea notificaciones).
- **Cuenta de Mercado Pago** (bloquea cobros).
- **Logo en alta + paleta de color** (bloquea diseño visual).
- **Teléfono y correo público** (página de contacto).
- **¿Meses sin intereses? sí/no** (config de pagos).
- **¿Mostrar productos agotados? sí/no** (catálogo; recomendación: mostrar con aviso).

---

## Implicaciones Importantes de Estas Decisiones

### Por ser tienda permanente (no eventos)
- El **agente de sincronización corre 24/7**, no solo durante eventos.
- Debe instalarse como servicio Windows permanente con autoarranque.
- El buffer de seguridad protege ventas simultáneas (mostrador físico + web) todo el tiempo.

### Por facturación manual en la tienda (no en la web)
- La web NO integra facturación electrónica ni captura obligatoria de datos fiscales.
- Solo se ofrece una casilla opcional "¿Necesitas factura?"; si la marca, se guarda la solicitud (`factura_solicitada`) y opcionalmente sus datos en `datos_factura`.
- La tienda genera la factura manualmente con su sistema físico.
- No se necesita CSD del SAT para la web.

### Por precio "igual con opción de cambiar"
- El stock SÍ se sincroniza desde Eleventa automáticamente.
- El precio se jala de Eleventa como **valor inicial**, pero el admin puede sobrescribirlo por producto.
- Agregar campo `price_overridden` (boolean) en `products`: si es `true`, el sync NO toca el precio.

### Por cupones desde el inicio
- Se necesita una tabla `coupons` y lógica de aplicación en el carrito/checkout (ver doc 02 actualizado).

### Por notificaciones Email + WhatsApp
- Email: usar Resend o el SMTP de Supabase.
- WhatsApp: usar la API de WhatsApp Business (Twilio o Meta Cloud API).

---

## Datos de Factura (opcional, para facturación manual)
Si el cliente marca "¿Necesitas factura?" en el checkout, se pueden capturar opcionalmente sus datos (RFC, razón social, etc.) y guardarlos en `orders.datos_factura` para que la tienda los use al facturar manualmente. NO es obligatorio ni se valida contra el SAT en la web.
