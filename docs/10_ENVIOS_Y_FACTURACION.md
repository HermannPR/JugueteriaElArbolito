# 10 — Envíos y Facturación

## PARTE 1 — Envíos

### Estrategia: Agregador Multi-Paquetería
En vez de integrar una sola paquetería, usar un **agregador** que conecta varias con una sola API y devuelve tarifas en tiempo real. Opciones en México:
- **Envía.com** — API robusta, buena cobertura.
- **Skydropx** — popular para e-commerce, fácil integración.
- **Enviosperros** — tarifas competitivas, con sucursales en Culiacán.

> **Por qué agregador:** Estafeta es fuerte en cobertura rural; FedEx en tiempos consistentes; Paquetexpress tiene presencia local en Culiacán. Un agregador deja elegir la más conveniente por cada envío sin múltiples integraciones.

### Cómo funciona el cálculo de envío
```
1. Cliente arma carrito → cada producto tiene products.weight (kg).
2. Sistema suma el peso total y toma el código postal de destino.
3. Llama a la API del agregador con: origen (CP de la tienda en Culiacán),
   destino (CP del cliente), peso, dimensiones.
4. El agregador devuelve varias opciones (paquetería + precio + días).
5. Se muestran al cliente para que elija, o se aplica una regla
   (ej. "la más barata").
6. El costo se suma al total y se guarda en orders.shipping_cost.
```

### Opción "Recoger en tienda"
- Costo de envío = $0.
- El cliente elige esta opción en el checkout.
- La orden se marca para recoger; se notifica cuando está lista.
- Dirección de la tienda física: Culiacán, Sinaloa (capturar dato exacto).

### Datos necesarios por producto
- `products.weight` (kg) — **crítico**, hay que capturarlo. Si falta, usar un peso por defecto por categoría.
- Dimensiones (opcional pero mejora la cotización): largo, ancho, alto.

> **Pendiente de datos:** El Excel de inventario NO trae peso. Hay que definir pesos. Sugerencia: asignar peso estimado por categoría como punto de partida y refinar los productos más vendidos.

### Variables de entorno
```
SHIPPING_PROVIDER_API_KEY=
SHIPPING_ORIGIN_POSTAL_CODE=   # CP de la tienda en Culiacán
SHIPPING_ORIGIN_ADDRESS=Mariano Escobedo 294-Poniente, Primer Cuadro, Centro, Culiacan Rosales, Sinaloa
```

---

## PARTE 2 — Facturación (la hace la tienda manualmente)

> **Decisión confirmada:** La dueña indicó que la **facturación la realizan ellos manualmente en la tienda física** (con su propio sistema/contador). Por lo tanto, la web **NO integra facturación electrónica** ni captura datos fiscales en el checkout.

### Qué implica esto
- **NO** se integra Facturapi ni ningún PAC en la web.
- **NO** se piden RFC, régimen fiscal ni uso de CFDI en el checkout.
- **NO** se necesita el CSD del SAT para la web.
- La tabla `invoices` y el flujo de facturación quedan **fuera del alcance** del proyecto web.

### Cómo se maneja la factura entonces
- El cliente que quiera factura la **solicita por separado** (WhatsApp o correo) y la tienda se la genera manualmente con su sistema físico.
- Recomendación de UX: en la página de confirmación de pedido y en el correo, incluir una nota: *"¿Necesitas factura? Escríbenos por WhatsApp con tu número de pedido y tus datos fiscales."* — esto canaliza la solicitud sin construir nada complejo.
- Guardar en la orden un campo simple `factura_solicitada` (boolean) por si el cliente marca que quiere factura, para que la tienda sepa a quién facturar manualmente.

> Si en el futuro el volumen crece y quieren automatizar, se puede agregar Facturapi después (la arquitectura lo permite). Por ahora se mantiene simple.

## PARTE 3 — Notificaciones (Email + WhatsApp)

### Email
- **Resend** (recomendado, fácil con Next.js) o SMTP de Supabase.
- Eventos: confirmación de orden, pago recibido, orden enviada, factura emitida.

### WhatsApp
- **WhatsApp Business API** vía Twilio o Meta Cloud API.
- Eventos: aviso de nueva orden al admin; confirmación al cliente.
- Requiere plantillas de mensaje aprobadas por Meta.

### Variables de entorno
```
RESEND_API_KEY=
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
ADMIN_WHATSAPP_NUMBER=         # a dónde llegan los avisos de nuevas órdenes
ADMIN_EMAIL=
```
