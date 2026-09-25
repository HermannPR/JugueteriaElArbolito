import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

// Del carrito solo se confía en qué producto y cuántos. Precio, nombre y stock
// se leen de la base: el navegador puede mandar cualquier cosa.
interface CheckoutItemInput {
  id: string;
  quantity: number;
}

interface CheckoutBody {
  items: CheckoutItemInput[];
  customer: { name: string; email: string; phone: string };
  shipping_method: "envio" | "pickup";
  shipping_address?: { street: string; city: string; state: string; zip: string; references?: string };
  factura_solicitada: boolean;
  datos_factura?: Record<string, string>;
  notes?: string;
}

const MAX_QTY_PER_ITEM = 20;
const MAX_LINES = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FACTURA_KEYS = ["rfc", "razon_social", "uso_cfdi", "email"] as const;

function orderNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `ARB-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Solicitud inválida");
  }

  // --- Validación de entrada -------------------------------------------------
  if (!Array.isArray(body.items) || body.items.length === 0) return badRequest("Carrito vacío");
  if (body.items.length > MAX_LINES) return badRequest("Demasiados productos en el carrito");

  // Unifica renglones repetidos del mismo producto.
  const quantities = new Map<string, number>();
  for (const item of body.items) {
    if (!item || typeof item.id !== "string" || !UUID_RE.test(item.id)) return badRequest("Producto inválido en el carrito");
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return badRequest("Cantidad inválida en el carrito");
    quantities.set(item.id, (quantities.get(item.id) ?? 0) + item.quantity);
  }
  for (const qty of Array.from(quantities.values())) {
    if (qty > MAX_QTY_PER_ITEM) return badRequest(`Máximo ${MAX_QTY_PER_ITEM} piezas por producto`);
  }

  const customer = {
    name: text(body.customer?.name, 120),
    email: text(body.customer?.email, 200).toLowerCase(),
    phone: text(body.customer?.phone, 30),
  };
  if (!customer.name || !EMAIL_RE.test(customer.email)) return badRequest("Datos de contacto incompletos");

  const shippingMethod = body.shipping_method;
  if (shippingMethod !== "envio" && shippingMethod !== "pickup") return badRequest("Método de entrega inválido");

  let shippingAddress: CheckoutBody["shipping_address"] | null = null;
  if (shippingMethod === "envio") {
    shippingAddress = {
      street: text(body.shipping_address?.street, 200),
      city: text(body.shipping_address?.city, 100),
      state: text(body.shipping_address?.state, 100),
      zip: text(body.shipping_address?.zip, 10),
      references: text(body.shipping_address?.references, 300) || undefined,
    };
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !/^\d{5}$/.test(shippingAddress.zip)) {
      return badRequest("Dirección de envío incompleta (calle, ciudad, estado y CP de 5 dígitos)");
    }
  }

  const facturaSolicitada = body.factura_solicitada === true;
  let datosFactura: Record<string, string> | null = null;
  if (facturaSolicitada && body.datos_factura) {
    datosFactura = {};
    for (const key of FACTURA_KEYS) datosFactura[key] = text(body.datos_factura[key], 200);
  }

  try {
    const supabase = createAdminClient();

    // --- Precios y stock desde la base ----------------------------------------
    const { data: products, error: productsErr } = await supabase
      .from("products")
      .select("id, name, price, stock, stock_buffer, eleventa_sku, image_url")
      .in("id", Array.from(quantities.keys()))
      .eq("is_active", true)
      .eq("is_approved", true);
    if (productsErr) throw productsErr;

    const lines = [];
    for (const [id, quantity] of Array.from(quantities.entries())) {
      const product = products?.find((p) => p.id === id);
      if (!product) return badRequest("Uno de los productos ya no está disponible. Actualiza tu carrito.");
      const available = product.stock - (product.stock_buffer ?? 0);
      if (available < quantity) {
        return badRequest(`Stock insuficiente para: ${product.name}. Disponible: ${Math.max(0, available)}`);
      }
      lines.push({ ...product, price: Number(product.price), quantity });
    }

    // Sumar en centavos evita errores de punto flotante.
    const subtotalCents = lines.reduce((s, l) => s + Math.round(l.price * 100) * l.quantity, 0);
    const shippingCost = 0; // Pendiente: cotización con el agregador de paquetería (docs/10).
    const subtotal = subtotalCents / 100;
    const total = subtotal + shippingCost;

    // --- Crear pedido ---------------------------------------------------------
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber(),
        customer_email: customer.email,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        shipping_method: shippingMethod,
        shipping_address: shippingAddress,
        items: lines.map((l) => ({ id: l.id, name: l.name, price: l.price, quantity: l.quantity, eleventa_sku: l.eleventa_sku })),
        subtotal,
        shipping_cost: shippingCost,
        total,
        factura_solicitada: facturaSolicitada,
        datos_factura: datosFactura,
        notes: text(body.notes, 500) || null,
      })
      .select("id, order_number, access_token")
      .single();
    if (orderErr || !order) throw orderErr ?? new Error("No se creó la orden");

    const { error: itemsErr } = await supabase.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.id,
        eleventa_sku: l.eleventa_sku,
        name: l.name,
        price: l.price,
        quantity: l.quantity,
      }))
    );
    if (itemsErr) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsErr;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const orderUrl = `${siteUrl}/pedido/${order.order_number}?t=${order.access_token}`;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";

    // Sin Mercado Pago configurado solo se permite simular en desarrollo.
    if (!accessToken) {
      if (process.env.NODE_ENV === "production") {
        await supabase.from("orders").delete().eq("id", order.id);
        console.error("Checkout: MERCADOPAGO_ACCESS_TOKEN no configurado en producción");
        return NextResponse.json({ error: "Los pagos en línea no están disponibles por el momento." }, { status: 503 });
      }
      return NextResponse.json({ order_number: order.order_number, init_point: `${orderUrl}&dev=1`, sandbox: true });
    }

    const mp = new MercadoPagoConfig({ accessToken });
    const preference = await new Preference(mp).create({
      body: {
        external_reference: order.order_number,
        items: lines.map((l) => ({
          id: l.id,
          title: l.name.slice(0, 256),
          unit_price: l.price,
          quantity: l.quantity,
          currency_id: "MXN",
          picture_url: l.image_url ?? undefined,
        })),
        payer: {
          name: customer.name.split(" ")[0],
          surname: customer.name.split(" ").slice(1).join(" ") || "-",
          email: customer.email,
          phone: customer.phone ? { area_code: "52", number: customer.phone } : undefined,
        },
        back_urls: { success: orderUrl, failure: orderUrl, pending: orderUrl },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "JUGUETERIA EL ARBOLITO",
        // Sin MSI (decisión de la dueña): el cliente difiere con su banco si quiere.
      },
    });

    await supabase.from("orders").update({ mp_preference_id: preference.id }).eq("id", order.id);

    const isSandbox = accessToken.startsWith("TEST-");
    return NextResponse.json({
      order_number: order.order_number,
      init_point: isSandbox ? preference.sandbox_init_point : preference.init_point,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Error interno al procesar el pago. Intenta de nuevo." }, { status: 500 });
  }
}
