import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
- Si te dan un número de pedido (formato ARB-XXXXXXXX-XXXXX), usa el estado que se te proporcione.
- NUNCA inventes precios, stock o disponibilidad. Solo informa lo que el contexto te dé.
- Si no puedes resolver la duda, sugiere contactar por WhatsApp o correo.
- Respuestas cortas y concretas. Máximo 3-4 oraciones por respuesta.
- No uses markdown excesivo; el texto se muestra en un chat.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function searchProducts(query: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("name, price, stock, categories(name)")
      .eq("is_active", true)
      .eq("is_approved", true)
      .gt("stock", 0)
      .ilike("name", `%${query}%`)
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

async function getOrderStatus(orderNumber: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("orders")
      .select("order_number, payment_status, order_status, created_at, total, customer_name")
      .eq("order_number", orderNumber)
      .single();

    if (!data) return "";
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
    };
    return `\nEstado del pedido ${data.order_number}: Pago: ${statusMap[data.payment_status] ?? data.payment_status} · Pedido: ${orderMap[data.order_status] ?? data.order_status} · Total: $${Number(data.total).toFixed(2)} MXN`;
  } catch {
    return "";
  }
}

async function callGroq(systemPrompt: string, messages: Message[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("placeholder")) throw new Error("Groq not configured");

  const { Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
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
    model: "gemini-1.5-flash",
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

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: Message[] };
    if (!messages?.length) return NextResponse.json({ error: "No messages" }, { status: 400 });

    // Limit to 20 messages total
    const trimmedMessages = messages.slice(-20);
    const lastUserMessage = trimmedMessages.findLast((m) => m.role === "user")?.content ?? "";

    // Enrich context: product search + order status
    let context = "";
    const orderMatch = lastUserMessage.match(/ARB-\d{8}-[A-Z0-9]+/i);
    if (orderMatch) {
      context += await getOrderStatus(orderMatch[0].toUpperCase());
    }

    const productKeywords = lastUserMessage.match(/\b\w{4,}\b/g)?.slice(0, 3).join(" ") ?? "";
    if (productKeywords && lastUserMessage.length < 200) {
      context += await searchProducts(productKeywords);
    }

    const systemPrompt = STORE_SYSTEM_PROMPT + (context ? `\n\nCONTEXTO ACTUAL:${context}` : "");

    let reply = "";
    let provider = "fallback";

    try {
      reply = await callGroq(systemPrompt, trimmedMessages);
      provider = "groq";
    } catch {
      try {
        reply = await callGemini(systemPrompt, trimmedMessages);
        provider = "gemini";
      } catch {
        reply = "Por el momento no puedo responder automáticamente. Por favor contáctanos por WhatsApp o correo y con gusto te atendemos.";
        provider = "fallback";
      }
    }

    return NextResponse.json({ reply, provider });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
