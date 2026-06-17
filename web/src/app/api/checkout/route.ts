import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@/lib/supabase/server";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
  eleventa_sku?: string | null;
}

interface CheckoutBody {
  items: CartItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping_method: "envio" | "pickup";
  shipping_address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    references?: string;
  };
  factura_solicitada: boolean;
  datos_factura?: Record<string, string>;
  notes?: string;
}

function orderNumber() {
  const d = new Date();
  return `ARB-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckoutBody = await req.json();
    const { items, customer, shipping_method, shipping_address, factura_solicitada, datos_factura, notes } = body;

    if (!items?.length) return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    if (!customer?.email || !customer?.name) return NextResponse.json({ error: "Datos de contacto incompletos" }, { status: 400 });
    if (shipping_method === "envio" && !shipping_address?.street) return NextResponse.json({ error: "Dirección de envío requerida" }, { status: 400 });

    const supabase = await createClient();

    // Validate stock for each item
    const productIds = items.map((i) => i.id);
    const { data: products } = await supabase
      .from("products")
      .select("id, stock, stock_buffer, price, name")
      .in("id", productIds)
      .eq("is_active", true)
      .eq("is_approved", true);

    for (const item of items) {
      const product = products?.find((p) => p.id === item.id);
      if (!product) return NextResponse.json({ error: `Producto no disponible: ${item.name}` }, { status: 400 });
      const available = product.stock - (product.stock_buffer ?? 0);
      if (available < item.quantity) {
        return NextResponse.json({ error: `Stock insuficiente para: ${product.name}. Disponible: ${available}` }, { status: 400 });
      }
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping_cost = shipping_method === "pickup" ? 0 : 0; // se calcula al momento del envío
    const total = subtotal + shipping_cost;
    const order_number = orderNumber();

    // Create order in DB
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number,
        customer_email: customer.email,
        customer_name: customer.name,
        customer_phone: customer.phone,
        shipping_address: shipping_address ?? null,
        shipping_method,
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, eleventa_sku: i.eleventa_sku })),
        subtotal,
        shipping_cost,
        total,
        payment_method: "mercadopago",
        payment_gateway: "mercadopago",
        payment_status: "pending",
        order_status: "pending",
        factura_solicitada,
        datos_factura: datos_factura ?? null,
        notes: notes ?? null,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) {
      console.error("Order creation error:", orderErr);
      return NextResponse.json({ error: "Error al crear la orden" }, { status: 500 });
    }

    // Also insert order_items rows
    await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.id,
        eleventa_sku: i.eleventa_sku ?? null,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }))
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";

    // Check if MP is configured
    if (!accessToken || accessToken.startsWith("TEST-placeholder")) {
      // Dev mode: return a mock init_point for testing without real MP account
      await supabase.from("orders").update({ mp_preference_id: "dev-mode", payment_status: "pending" }).eq("id", order.id);
      return NextResponse.json({
        order_number: order.order_number,
        init_point: `${siteUrl}/pedido/${order.order_number}?status=pending&dev=1`,
        sandbox: true,
      });
    }

    // Create MP preference
    const mp = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(mp);

    const { id: preferenceId, init_point, sandbox_init_point } = await preference.create({
      body: {
        external_reference: order.order_number,
        items: items.map((item) => ({
          id: item.id,
          title: item.name.slice(0, 256),
          unit_price: Number(item.price),
          quantity: item.quantity,
          picture_url: item.image_url ?? undefined,
        })),
        payer: {
          name: customer.name.split(" ")[0],
          surname: customer.name.split(" ").slice(1).join(" ") || "-",
          email: customer.email,
          phone: customer.phone ? { area_code: "52", number: customer.phone } : undefined,
        },
        back_urls: {
          success: `${siteUrl}/pedido/${order.order_number}?status=success`,
          failure: `${siteUrl}/pedido/${order.order_number}?status=failure`,
          pending: `${siteUrl}/pedido/${order.order_number}?status=pending`,
        },
        auto_return: "approved",
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "JUGUETERIA EL ARBOLITO",
        // MSI desactivados (decisión de la dueña — cliente paga intereses con su banco)
      },
    });

    await supabase.from("orders").update({ mp_preference_id: preferenceId }).eq("id", order.id);

    const isSandbox = accessToken.startsWith("TEST-");

    return NextResponse.json({
      order_number: order.order_number,
      init_point: isSandbox ? sandbox_init_point : init_point,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Error interno al procesar el pago" }, { status: 500 });
  }
}
