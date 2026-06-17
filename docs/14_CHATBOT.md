# 14 — Chatbot de Atención

> Nota de la dueña: al final del recibo de compra poner "¿Tienes preguntas?" que redirige al chatbot y a la sección de contacto (correo y número). El chatbot atiende dudas de clientes sobre productos, pedidos y la tienda.

---

## A. Propósito

Un asistente conversacional en la web que:
- Responde preguntas frecuentes (horarios, envíos, métodos de pago, ubicación).
- Ayuda a encontrar productos del catálogo ("¿tienen muñecas?", "algo para niño de 5 años").
- Da estado de un pedido (si el cliente da su número de orden).
- Si no sabe, redirige a contacto humano (WhatsApp/correo).

---

## B. Arquitectura con Fallback (Groq + Gemini)

Para robustez y costo bajo, usar **varios proveedores LLM con fallback**: si uno falla o se agota la cuota, se usa el siguiente.

```
Cliente escribe en el chat
   │
   ▼
Backend (Edge Function / API route)
   │
   ├─ Intenta Proveedor 1: Groq (rápido y barato)
   │     │
   │     └─ ¿Error / cuota agotada? ─┐
   │                                 ▼
   ├─ Fallback Proveedor 2: Google Gemini
   │     │
   │     └─ ¿Error? ─┐
   │                 ▼
   └─ Fallback final: respuesta fija + botón WhatsApp
        "En este momento no puedo responder,
         escríbenos por WhatsApp." [Botón: Enviar mensaje por WhatsApp]
```

> El botón de WhatsApp también aparece cuando el bot detecta que no puede resolver la duda del cliente (no solo cuando fallan los proveedores). Abre WhatsApp (`https://wa.me/52XXXXXXXXXX?text=...`) con un mensaje prellenado.

### Por qué Groq + Gemini
- **Groq:** inferencia muy rápida y económica, buen primer intento.
- **Gemini:** respaldo confiable de Google con capa gratuita generosa.
- Ambos tienen API simple; el fallback evita que el chat se caiga si un proveedor falla.

---

## C. Contexto que se le da al Chatbot (RAG ligero)

Para que responda bien sin alucinar, se le inyecta contexto en el prompt del sistema:
- Info de la tienda: horarios, ubicación, envíos a todo México, no hay devoluciones, métodos de pago.
- Catálogo: se le puede pasar una búsqueda de productos relevante a lo que pregunta el cliente (consulta a `products` por keywords y se le pasan los resultados).
- Estado de pedido: si el cliente da número de orden, se consulta `orders` y se le pasa el estado.

> **Importante:** El chatbot NO inventa precios ni stock. Siempre consulta la base de datos para datos reales y solo usa el LLM para redactar la respuesta.

---

## D. Flujo de Búsqueda de Productos en el Chat
```
Cliente: "¿tienen algo para una niña de 3 años?"
   │
   ▼
Backend extrae intención → busca en products
   (categoría Muñecas/Didácticos, rango edad, is_active=true, aprobados)
   │
   ▼
Pasa los 3-5 productos top al LLM como contexto
   │
   ▼
LLM redacta: "¡Claro! Te recomiendo estas opciones..."
   con links a los productos
```

---

## E. Límites y Seguridad
- Limitar longitud de conversación y número de mensajes por sesión (evitar abuso de API).
- No exponer las API keys en el frontend: todo pasa por el backend.
- Rate limiting por IP/sesión.
- Registrar conversaciones (opcional) para mejorar respuestas.

---

## F. Variables de Entorno
```
GROQ_API_KEY=
GEMINI_API_KEY=
CHATBOT_MAX_MESSAGES_PER_SESSION=20
```

---

## G. Configuración Confirmada
- **Tono:** amigable pero formal (cercano y cálido, acorde a una juguetería familiar, pero respetuoso y profesional).
- **Escalamiento a humano:** cuando el chatbot no pueda resolver una duda, muestra un **botón "Enviar mensaje por WhatsApp"** que abre WhatsApp con el número del negocio y un mensaje prellenado. No registra tickets internos por ahora; simplemente redirige a WhatsApp.
- **Idioma:** español (México).
