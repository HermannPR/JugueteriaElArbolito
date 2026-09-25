import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Valida el header x-signature de Mercado Pago.
 * Plantilla firmada: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * (se omite cada parte cuyo valor no venga). Clave: MERCADOPAGO_WEBHOOK_SECRET,
 * la "clave secreta" de Webhooks en el panel de Mercado Pago.
 */
function hasValidSignature(req: NextRequest, dataId: string, secret: string): boolean {
  const signature = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id");
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=", 2).map((s) => s.trim()) as [string, string])
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
  if (!accessToken || !webhookSecret) {
    console.error("MP webhook: faltan MERCADOPAGO_ACCESS_TOKEN o MERCADOPAGO_WEBHOOK_SECRET");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const type = req.nextUrl.searchParams.get("type") ?? body?.type;
  const dataId = String(req.nextUrl.searchParams.get("data.id") ?? body?.data?.id ?? "");

  if (!hasValidSignature(req, dataId, webhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true });

  try {
    // Nunca se confía en el cuerpo de la notificación: se consulta el pago a MP.
    const payment = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: dataId });
    const orderNumber = payment.external_reference;
    if (!orderNumber) return NextResponse.json({ ok: true });

    const supabase = createAdminClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, total, payment_status, payment_gateway_id, order_status")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) {
      // 200 para que MP no reintente algo que nunca va a existir.
      console.error(`MP webhook: pedido ${orderNumber} no existe (pago ${payment.id})`);
      return NextResponse.json({ ok: true });
    }

    const paymentId = String(payment.id);
    const gatewayFields = { payment_gateway_id: paymentId, payment_gateway_raw: payment as unknown as Record<string, unknown> };

    switch (payment.status) {
      case "approved": {
        const amountOk =
          payment.currency_id === "MXN" &&
          Math.round(Number(payment.transaction_amount) * 100) === Math.round(Number(order.total) * 100);

        // Transición condicional: solo UNA entrega del webhook gana el paso a "paid"
        // y descuenta stock, aunque MP mande la misma notificación varias veces.
        const { data: won, error: winErr } = await supabase
          .from("orders")
          .update({ payment_status: "paid", order_status: amountOk ? "processing" : "requires_attention", ...gatewayFields })
          .eq("id", order.id)
          .neq("payment_status", "paid")
          .select("id");
        if (winErr) throw winErr;
        if (!won?.length) break;

        if (!amountOk) {
          console.error(`MP webhook: monto no cuadra en ${orderNumber}: pagado ${payment.transaction_amount} ${payment.currency_id}, esperado ${order.total} MXN`);
          break;
        }

        const { data: items, error: itemsErr } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", order.id);
        if (itemsErr) throw itemsErr;

        const problems: string[] = [];
        for (const item of items ?? []) {
          if (!item.product_id) continue;
          const { data: result, error } = await supabase.rpc("apply_stock_movement", {
            p_product_id: item.product_id,
            p_delta: -item.quantity,
            p_reason: "sale",
            p_order_id: order.id,
            p_idempotency_key: `sale:${order.id}:${item.product_id}`,
            p_notes: `Pago MP ${paymentId}`,
          });
          if (error) throw error;
          if (result?.status !== "ok" && result?.status !== "already_applied") {
            problems.push(`${item.product_id}: ${result?.status}`);
          }
        }
        if (problems.length) {
          // Se cobró pero no alcanzó el stock web: la tienda decide (surtir o reembolsar).
          await supabase
            .from("orders")
            .update({ order_status: "requires_attention", notes: `Stock insuficiente al confirmar pago: ${problems.join(", ")}` })
            .eq("id", order.id);
        }
        break;
      }

      case "rejected":
      case "cancelled":
        // Un intento rechazado no debe cancelar un pedido ya pagado con otro intento.
        await supabase
          .from("orders")
          .update({ payment_status: "failed", order_status: "cancelled", ...gatewayFields })
          .eq("id", order.id)
          .eq("payment_status", "pending");
        break;

      case "refunded":
      case "charged_back":
        // Solo si es el mismo pago que confirmó el pedido. El stock lo repone la tienda.
        if (order.payment_gateway_id === paymentId) {
          await supabase
            .from("orders")
            .update({ payment_status: "refunded", order_status: "requires_attention", ...gatewayFields })
            .eq("id", order.id);
        }
        break;

      default:
        // pending / in_process / authorized: el pedido sigue pendiente.
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 500 → MP reintenta más tarde.
    console.error("MP webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
