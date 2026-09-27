import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const STORE_SYSTEM_PROMPT = `Eres el asistente virtual de Juguetería El Arbolito, una juguetería familiar en Culiacán, Sinaloa, con más de 50 años de tradición (desde 1975). Tu nombre es "Arbolito".

INFORMACIÓN DE LA TIENDA:
- Dirección: Mariano Escobedo 294-Poniente, Primer Cuadro, Centro, 80000 Culiacán Rosales, Sinaloa.
- Horario: Lunes a Viernes 10:00–18:30, Sábado 10:00–18:00. Domingo: cerrado.
- Redes sociales: Instagram @elarbolitotoys, Facebook "Juguetería El Arbolito".
- Envíos: enviamos a todo México por paquetería. El costo se calcula según el destino y se confirma por correo o WhatsApp.
- Métodos de pago: tarjeta de crédito/débito, OXXO, transferencia SPEI — todo a través de Mercado Pago.
- NO ofrecemos meses sin intereses por parte de la tienda. El cliente puede diferir con su banco, pero los intereses son del banco.
- No aceptamos devoluciones. Todos los precios son en pesos mexicanos (MXN).
- Recoger en tienda: disponible sin costo adicional.
- Factura: disponible, se solicita al hacer el pedido y se emite manualmente en tienda.

CATEGORÍAS DE PRODUCTOS:
Didácticos, Muñecas y bebés, Deportes, Dinosaurios, Libros, Coleccionables, Casitas y juegos de jardín, Mi alegría.

INSTRUCCIONES:
- Responde siempre en español de México, con tono amigable, cercano y profesional.
- Si te preguntan por un producto, usa el contexto de catálogo que se te proporcione.
- Si te dan un número de pedido (formato ARB-XXXXXXXX-XXXXX), usa el estado que se te proporcione. Si el contexto dice que falta la liga del pedido, pide que peguen la liga completa que recibieron al pagar (o que la abran directamente).
- NUNCA inventes precios, stock o disponibilidad. Solo informa lo que el contexto te dé.
- Si no puedes resolver la duda, sugiere contactar por WhatsApp o correo.
- Respuestas cortas y concretas. Máximo 3-4 oraciones por respuesta.
- No uses markdown excesivo; el texto se muestra en un chat.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Palabras útiles del mensaje (con acentos y ñ); se busca cada una por separado.
const STOPWORDS = new Set(["tienen", "tienes", "quiero", "busco", "hola", "para", "precio", "cuanto", "cuánto", "tienda", "gracias", "juguete", "juguetes"]);
function keywords(text: string): string[] {
  return Array.from(new Set((text.toLowerCase().match(/[\p{L}\d]{4,}/gu) ?? []).filter((w) => !STOPWORDS.has(w)))).slice(0, 3);
}

async function searchProducts(words: string[]): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("name, price, stock, categories(name)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .gt("stock", 0)
      .or(words.map((w) => `name.ilike.%${w.replace(/[,()*%\\]/g, "")}%`).join(","))
      .limit(5);

    if (!data?.length) return "";
    const lines = data.map((p) => {
      const cat = (Array.isArray(p.categories) ? p.categories[0] : p.categories) as { name: string } | null;
      return `- ${p.name} · $${Number(p.price).toFixed(2)} MXN · ${p.stock} en stock${cat ? ` · Categoría: ${cat.name}` : ""}`;
    });
    return `\nProductos encontrados en catálogo:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

async function getOrderStatus(orderNumber: string, token: string | null): Promise<string> {
  // Igual que /pedido/[order_number]: sin el token secreto de la liga no se
  // revela nada, o cualquiera con el número vería si un pedido ajeno se pagó.
  if (!token) {
    return `\nPedido ${orderNumber}: por seguridad no se muestra el estado sin la liga del pedido. Pide al cliente que pegue la liga completa que recibió al pagar.`;
  }
  try {
    // orders no es legible con la anon key; solo se exponen estado y total.
    const { data } = await createAdminClient()
      .from("orders")
      .select("order_number, payment_status, order_status, total")
      .eq("order_number", orderNumber)
      .eq("access_token", token)
      .maybeSingle();

    if (!data) return `\nPedido ${orderNumber}: no se encontró con esa liga. Pide al cliente que revise la liga que recibió al pagar.`;
    const statusMap: Record<string, string> = {
      pending: "pendiente de pago",
      paid: "pago confirmado",
      failed: "pago fallido",
      refunded: "reembolsado",
    };
    const orderMap: Record<string, string> = {
      pending: "en espera",
      processing: "en preparación",
      shipped: "enviado",
      delivered: "entregado",
      cancelled: "cancelado",
      requires_attention: "en revisión por la tienda",
    };
    return `\nEstado del pedido ${data.order_number}: Pago: ${statusMap[data.payment_status] ?? data.payment_status} · Pedido: ${orderMap[data.order_status] ?? data.order_status} · Total: $${Number(data.total).toFixed(2)} MXN`;
  } catch {
    return "";
  }
}

// Modelos gratuitos, en orden de preferencia.
const DEFAULT_OPENROUTER_MODELS =
  "nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free,qwen/qwen3.8-27b:free";

// OpenRouter habla el formato de OpenAI; se llama con fetch para no sumar dependencias.
async function callOpenRouter(systemPrompt: string, messages: Message[]): Promise<string> {
  // trim(): una llave pegada con BOM o salto de línea rompe el header Authorization.
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith("placeholder")) throw new Error("OpenRouter not configured");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://jugueteria-el-arbolito.vercel.app",
      "X-Title": "Jugueteria El Arbolito",
    },
    // OPENROUTER_MODEL admite varios separados por coma: OpenRouter prueba el
    // siguiente si uno está saturado (los modelos :free suelen dar 429).
    body: JSON.stringify({
      models: (process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODELS)
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      // Sin razonamiento: los modelos que "piensan" gastaban los 300 tokens
      // pensando y devolvían la respuesta vacía.
      reasoning: { enabled: false },
      max_tokens: 300,
      temperature: 0.6,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("OpenRouter empty reply");
  return reply;
}

async function callGroq(systemPrompt: string, messages: Message[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("placeholder")) throw new Error("Groq not configured");

  const { Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: 300,
    temperature: 0.6,
  });

  return completion.choices[0]?.message?.content ?? "";
}

async function callGemini(systemPrompt: string, messages: Message[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("placeholder")) throw new Error("Gemini not configured");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const lastMessage = messages[messages.length - 1].content;
  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}

const MAX_MESSAGES = 20;
const MAX_CHARS = 500;
const RATE_LIMIT = 20;            // mensajes…
const RATE_WINDOW_SECONDS = 600;  // …por visitante cada 10 minutos

function clientKey(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocido";
  return "chat:" + createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
    const raw = Array.isArray(body?.messages) ? body.messages : [];
    const messages: Message[] = raw
      .slice(-MAX_MESSAGES)
      .filter((m): m is Message => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
    }

    // Límite por visitante, guardado en la base (Vercel reparte las peticiones entre instancias).
    const { data: allowed, error: rateErr } = await createAdminClient().rpc("chat_rate_hit", {
      p_key: clientKey(req),
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SECONDS,
    });
    if (rateErr) console.error("chat_rate_hit:", rateErr.message);
    if (allowed === false) {
      return NextResponse.json(
        { reply: "Recibimos muchos mensajes seguidos. Espera unos minutos o escríbenos por WhatsApp.", provider: "limit" },
        { status: 429 }
      );
    }

    const lastUserMessage = messages[messages.length - 1].content;

    // Contexto: estado de pedido y búsqueda de productos
    let context = "";
    const orderMatch = lastUserMessage.match(/ARB-\d{8}-[A-Z0-9]+/i);
    if (orderMatch) {
      // El token viaja en la liga del pedido como ?t=<uuid>.
      const tokenMatch = lastUserMessage.match(/[?&]t=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      context += await getOrderStatus(orderMatch[0].toUpperCase(), tokenMatch ? tokenMatch[1].toLowerCase() : null);
    }

    const words = keywords(lastUserMessage);
    if (words.length) {
      context += await searchProducts(words);
    }

    const systemPrompt = STORE_SYSTEM_PROMPT + (context ? `\n\nCONTEXTO ACTUAL:${context}` : "");

    let reply = "";
    let provider = "fallback";

    // OpenRouter → Groq → Gemini: el primero configurado que responda.
    const providers: Array<[string, (s: string, m: Message[]) => Promise<string>]> = [
      ["openrouter", callOpenRouter],
      ["groq", callGroq],
      ["gemini", callGemini],
    ];
    for (const [name, call] of providers) {
      try {
        reply = await call(systemPrompt, messages);
        provider = name;
        break;
      } catch (err) {
        // siguiente proveedor; se registra para ver en los logs de Vercel por qué falló
        console.warn(`chat: ${name} falló:`, err instanceof Error ? err.message : err);
      }
    }
    if (!reply) {
      reply = "Por el momento no puedo responder automáticamente. Por favor contáctanos por WhatsApp o correo y con gusto te atendemos.";
      provider = "fallback";
    }

    return NextResponse.json({ reply, provider });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
