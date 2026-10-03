// Decide qué hacer con la respuesta de la RPC chat_rate_hit (límite de
// mensajes del chat). Falla cerrado: si el limitador no responde bien, el chat
// no queda sin límite. Sin imports a propósito, para probarlo con node --test.

export interface RateLimitBlock {
  status: 429 | 503;
  body: { reply: string; provider: "limit" | "unavailable" };
}

export function rateLimitBlock(allowed: unknown, error: { message: string } | null): RateLimitBlock | null {
  if (!error && allowed === true) return null;
  if (!error && allowed === false) {
    return {
      status: 429,
      body: { reply: "Recibimos muchos mensajes seguidos. Espera unos minutos o escríbenos por WhatsApp.", provider: "limit" },
    };
  }
  // Error de la RPC o respuesta inesperada (undefined, null…).
  return {
    status: 503,
    body: {
      reply: "Por el momento no puedo responder. Escríbenos por WhatsApp y con gusto te atendemos.",
      provider: "unavailable",
    },
  };
}
