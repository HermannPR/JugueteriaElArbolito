import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    // Only handle payment notifications
    if (type !== "payment" || !data?.id) {
      return NextResponse.json({ ok: true });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
    if (!accessToken || accessToken.startsWith("TEST-placeholder")) {
      return NextResponse.json({ ok: true, skipped: "no mp configured" });
    }

    const mp = new MercadoPagoConfig({ accessToken });
    const paymentClient = new Payment(mp);
    const payment = await paymentClient.get({ id: data.id });

    const orderNumber = payment.external_reference;
    if (!orderNumber) return NextResponse.json({ ok: true });

    const supabase = await createClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, payment_status, items, order_status")
      .eq("order_number", orderNumber)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const mpStatus = payment.status; // approved, pending, rejected, cancelled, refunded
    let paymentStatus = "pending";
    let orderStatus = order.order_status;

    if (mpStatus === "approved") {
      paymentStatus = "paid";
      orderStatus = order.order_status === "pending" ? "processing" : order.order_status;
    } else if (mpStatus === "rejected" || mpStatus === "cancelled") {
      paymentStatus = "failed";
      orderStatus = "cancelled";
    } else if (mpStatus === "refunded" || mpStatus === "charged_back") {
      paymentStatus = "refunded";
    }

    // Update order
    await supabase.from("orders").update({
      payment_status: paymentStatus,
      order_status: orderStatus,
      payment_gateway_id: String(payment.id),
      payment_gateway_raw: payment as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);

    // Discount stock on first successful payment
    if (mpStatus === "approved" && order.payment_status !== "paid") {
      const items = order.items as Array<{ id: string; quantity: number }>;
      for (const item of items ?? []) {
        await supabase.rpc("apply_stock_movement", {
          p_product_id: item.id,
          p_delta: -item.quantity,
          p_reason: "sale",
          p_order_id: order.id,
          p_idempotency_key: `sale:${order.id}:${item.id}`,
          p_notes: `Pago MP ${payment.id}`,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("MP webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
