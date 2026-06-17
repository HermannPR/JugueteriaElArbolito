# 06 — Pasarela de Pago (recomendación para México)

## Recomendación: Mercado Pago como principal

Para una juguetería que vende **a consumidor final en México (B2C)**, la mejor opción es **Mercado Pago Checkout Pro**. Aquí el porqué:

### Razones a favor de Mercado Pago
1. **Confianza local:** Millones de mexicanos ya tienen la app de Mercado Pago. Un checkout con MP convierte entre 10-20% más que una pasarela desconocida en e-commerce B2C de LATAM.
2. **OXXO Pay nativo:** En México, OXXO representa alrededor del 14% del e-commerce. Mucha gente no tiene o no quiere usar tarjeta. MP integra el pago en efectivo en OXXO de forma muy madura. **Esto es clave para una juguetería**, donde muchos compradores son familias que pagan en efectivo.
3. **Meses sin intereses (MSI):** Entre el 40-60% del e-commerce en México se paga en cuotas. MP los maneja nativamente con todos los bancos. Para juguetes caros (carros eléctricos, casitas que cuestan miles de pesos), los MSI aumentan mucho la conversión.
4. **Transferencias SPEI** integradas.

### Comisiones aproximadas (verificar al integrar)
- Checkout Pro: alrededor de **3.5%-4.5% + IVA** según el plan de acreditación (inmediata vs 14 días).
- Acreditación a 14 días reduce la comisión; inmediata cuesta más.
- OXXO y SPEI tienen sus propias tarifas.

> ⚠️ Las comisiones cambian. Confirmar las tarifas vigentes en la cuenta de Mercado Pago al momento de integrar.

### Meses Sin Intereses (MSI) — Explicación Completa

### ⚠️ Decisión confirmada: NO ofrecer MSI (usar "meses con intereses")
La dueña decidió **no absorber el costo de los meses sin intereses** (le quitaría dinero). En su lugar se usa **"meses con intereses"**: el cliente puede diferir su pago a mensualidades, pero **el interés lo cobra el banco al cliente**, no la tienda.

- En Mercado Pago, la opción **"Ofrecer meses sin intereses" queda DESACTIVADA**.
- El cliente que pague con tarjeta de crédito todavía puede elegir pagar a meses con su banco; ese interés es entre el banco y el cliente, **sin costo para la tienda**.
- La tienda solo paga la comisión normal de cobro (~3.5%–4.5%), nada de la comisión extra de MSI.

> La explicación de abajo queda como REFERENCIA por si en el futuro se quiere reconsiderar, pero la configuración inicial es **SIN MSI**.

### Cómo funcionan los MSI (referencia)
"Meses sin intereses" significa que el cliente paga su compra en varias mensualidades con su tarjeta de crédito, **sin que a él le cobren intereses**. El cliente recibe su producto completo de inmediato y lo paga poco a poco. Esto sube mucho la conversión en productos caros (montables, carros eléctricos, casitas).

**¿Quién paga el costo entonces?** El negocio (la tienda) **absorbe una comisión adicional** que cobra Mercado Pago por ofrecer este beneficio. Es decir: el cliente no paga intereses, pero la tienda recibe un poco menos de dinero por esa venta.

### Cómo se activa (lo hace la dueña, sin programación)
Se activa desde la cuenta de Mercado Pago: en el menú **Negocio → Configuración → "Comisiones y MSI"**, selecciona Checkout, entra a "Por ofrecer MSI", activa "MSI con tarjeta de crédito" y elige el máximo de meses a ofrecer. La opción funciona automáticamente con Checkout Pro (que es lo que usa la web), sin necesidad de programar nada especial.

### Comisiones de MSI en Mercado Pago (2026)
A la comisión normal de cobro se le SUMA esta comisión extra según los meses que elija el cliente (más IVA):

| Plazo | Comisión extra por MSI |
|-------|------------------------|
| Hasta 3 meses | 4.69% + IVA |
| Hasta 6 meses | 7.69% + IVA |
| Hasta 9 meses | 11.19% + IVA |
| Hasta 12 meses | 12.89% + IVA |
| Hasta 18 meses | 19.39% + IVA |
| Hasta 24 meses | 27.29% + IVA |

### Ejemplo real (producto de $3,000 a 12 MSI)
- Comisión base de cobro (~3.49% + $4): ~$108
- Comisión extra por 12 MSI (12.89%): ~$387
- Más IVA sobre las comisiones (~$79)
- **Total de comisiones: ~$575 → la tienda recibe ~$2,425** (comisión efectiva ~19%).

> ⚠️ **Advertencia clave para la dueña:** Si el margen de ganancia de un producto es menor al ~19%, ofrecer 12 MSI haría perder dinero en esa venta. **Recomendación:** ofrecer MSI solo en plazos cortos (3 o 6 meses, donde la comisión es 4.69%-7.69%) y solo en productos caros con buen margen. Por ejemplo, ofrecer "hasta 6 MSI" es un buen equilibrio entre atractivo para el cliente y costo para la tienda.

### Recomendación de configuración inicial
- Activar MSI **solo hasta 6 meses** al inicio (comisión 7.69% + IVA máximo).
- Aplicarlos solo en productos arriba de cierto precio (ej. $1,500+), que es donde el cliente realmente los necesita.
- Revisar márgenes con el contador antes de subir a 12 o más meses.

> Estas comisiones cambian. Confirmar los valores vigentes en la sección "Comisiones y MSI" de la cuenta de Mercado Pago.

---

## ¿Cuándo considerar Stripe en su lugar?
Stripe es más barato (~3.49% + $4 MXN) y técnicamente más limpio, pero conviene más si:
- Vendes a clientes internacionales.
- Es un SaaS con suscripciones recurrentes.

Para venta nacional de juguetes a consumidor con necesidad de OXXO y MSI, **Mercado Pago gana**.

### Estrategia ideal (futuro)
Empezar con Mercado Pago. Si más adelante se quiere cobrar con tarjeta de forma más barata, se puede agregar Stripe como opción secundaria. Pero para el lanzamiento, **solo Mercado Pago** mantiene el sistema simple.

---

## Integración Técnica (Checkout Pro)

### Flujo
```
1. Cliente arma carrito → va a checkout.
2. El backend (Next.js API o Edge Function) crea una "preferencia de pago"
   en Mercado Pago con los ítems y el total.
3. MP devuelve un init_point (URL) → se redirige al cliente.
4. Cliente paga en la página segura de MP (tarjeta, OXXO, SPEI, MSI).
5. MP redirige de vuelta a la tienda (success / failure / pending).
6. MP envía un WEBHOOK al backend confirmando el pago.
7. El webhook actualiza orders.payment_status y dispara el descuento de stock.
```

### Componentes a construir
- **Crear preferencia:** endpoint que recibe el carrito y crea la preferencia en MP.
- **Webhook de notificación:** Supabase Edge Function que recibe los avisos de MP.
  - Verifica la firma/autenticidad del webhook.
  - Actualiza la orden.
  - Llama a `apply_stock_movement` por cada ítem (con `idempotency_key` = `order_id:product_id`).
- **Páginas de retorno:** `/pedido/[order_number]` mostrando éxito, pendiente (OXXO) o fallo.

### Datos a guardar en `orders`
- `payment_gateway = 'mercadopago'`
- `payment_gateway_id` = ID del pago en MP
- `payment_gateway_raw` = JSON completo del webhook (para auditoría)
- `payment_status`: `pending` (OXXO sin pagar), `paid`, `failed`, `refunded`

### Manejo de OXXO (importante)
- Cuando el cliente elige OXXO, la orden queda en `pending` y MP genera un voucher.
- El stock se debe **reservar** (no descontar definitivo) hasta que pague.
- Recomendación: descontar del buffer / marcar como "reservado" con caducidad (ej. 3 días).
- Si no paga en el plazo, liberar el stock.

---

## Variables de Entorno Necesarias
```
MERCADOPAGO_ACCESS_TOKEN=   # token privado (servidor)
MERCADOPAGO_PUBLIC_KEY=     # llave pública (cliente)
MERCADOPAGO_WEBHOOK_SECRET= # para verificar webhooks
```
> Nunca exponer el access token en el frontend.
