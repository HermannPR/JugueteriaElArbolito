# 15 — Cuenta de Correo Central e Integraciones

> Decisión confirmada: se creará un **correo central del negocio** que se usará para TODAS las integraciones de la web y para recibir los avisos. Adicionalmente, se pueden registrar otros correos (del personal de la dueña) para que también reciban notificaciones.

---

## A. Por qué un correo central (no el personal de la dueña)

Usar un correo dedicado del negocio (no el correo personal de nadie) es la práctica correcta porque:
- **Continuidad:** si un empleado se va, no se pierde el acceso a las integraciones.
- **Orden:** todos los avisos, facturas y registros de servicios llegan a un solo lugar.
- **Seguridad:** las contraseñas de servicios críticos (Mercado Pago, facturación) no quedan en un correo personal.

### Recomendación de correo
Crear algo como **`contacto@elarbolitotoys.com`** (si se compra el dominio) o, como inicio gratuito, **`elarbolitotoys@gmail.com`** o similar. Lo ideal a futuro es tener el dominio propio (`elarbolitotoys.com`) y correos con ese dominio, porque se ve más profesional y permite usarlo como remitente de los correos automáticos de la tienda.

---

## B. Para qué se usa este correo central

Este correo será el "dueño" de todas estas cuentas/servicios:
1. **Mercado Pago** — cuenta de vendedor (cobros).
2. **Agregador de envíos** (Envía/Skydropx).
3. **Google Cloud** — para Custom Search (imágenes) y Gemini (chatbot).
4. **Groq** — chatbot.
5. **Resend** — envío de correos de la tienda.
6. **Vercel** — hosting.
7. **Supabase** — ya existe, idealmente migrar a este correo.
(Facturación NO aplica: la tienda factura manual en físico.)

> **Importante:** Guardar todas las contraseñas en un gestor (ej. el propio Google, Bitwarden, o un documento muy seguro). El acceso a este correo es el acceso a todo el negocio digital.

---

## C. Correos que RECIBEN avisos (notificaciones)

El sistema permite configurar **varios destinatarios** para los avisos de nuevas órdenes. En `store_settings` se guarda una lista de correos:
- El correo central del negocio (siempre).
- Correos del personal de la dueña que ella decida (ej. su correo, el de un encargado).

Cuando entra una orden nueva, el sistema envía el aviso a TODOS los correos de esa lista, más el WhatsApp configurado.

### Estructura en la base (store_settings)
```json
{
  "notification_emails": ["contacto@elarbolitotoys.com", "personal1@gmail.com"],
  "notification_whatsapp": ["+52..."]
}
```
Esto se administra desde `/admin/configuracion` (la dueña puede agregar/quitar correos sin tocar código).

---

## D. Pasos para la Dueña / Encargado
1. Decidir el nombre del correo central (sugerencia: relacionado a la marca).
2. Crearlo (Gmail gratis para empezar, o con dominio propio si se compra).
3. Con ESE correo, ir creando las cuentas de los servicios (lista sección B) — esto se hace conforme avanza el desarrollo, no todo de golpe.
4. Decidir qué correos del personal recibirán también los avisos.
5. Definir el número de WhatsApp que recibirá los avisos.

---

## E. Sobre el Dominio (opcional pero recomendado)
- Comprar `elarbolitotoys.com` (o el que esté disponible) cuesta ~$150-300 MXN/año.
- Permite: correos profesionales (`contacto@...`), la web en `www.elarbolitotoys.com`, y mejor imagen de marca.
- Se puede empezar sin dominio (usando el subdominio gratis de Vercel) y comprarlo después.
