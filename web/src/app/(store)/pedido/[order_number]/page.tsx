import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CheckCircle, Clock, XCircle, MapPin, Phone, Mail } from "lucide-react";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ order_number: string }>;
  searchParams: Promise<{ status?: string; dev?: string }>;
}) {
  const { order_number } = await params;
  const { status: urlStatus } = await searchParams;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", order_number)
    .single();

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold mb-2">Pedido no encontrado</p>
        <Link href="/" className="text-primary hover:underline text-sm">Volver al inicio</Link>
      </div>
    );
  }

  const effectiveStatus = urlStatus ?? (order.payment_status === "paid" ? "success" : order.payment_status === "failed" ? "failure" : "pending");

  const isSuccess = effectiveStatus === "success" || order.payment_status === "paid";
  const isPending = effectiveStatus === "pending" && order.payment_status !== "paid" && order.payment_status !== "failed";
  const isFailure = effectiveStatus === "failure" || order.payment_status === "failed";

  const items = order.items as Array<{ name: string; price: number; quantity: number }>;
  const shippingAddr = order.shipping_address as { street: string; city: string; state: string; zip: string; references?: string } | null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Status header */}
      <div className="text-center mb-8">
        {isSuccess && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="font-display font-bold text-2xl text-green-700">¡Pago confirmado!</h1>
            <p className="text-muted-foreground mt-2">Tu pedido está en proceso. Te avisaremos por correo.</p>
          </>
        )}
        {isPending && (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="font-display font-bold text-2xl text-amber-700">Pago pendiente</h1>
            <p className="text-muted-foreground mt-2">
              {order.payment_method === "oxxo"
                ? "Realiza tu pago en cualquier OXXO con el voucher que te llegará por correo."
                : "Estamos esperando la confirmación de tu pago."}
            </p>
          </>
        )}
        {isFailure && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="font-display font-bold text-2xl text-red-700">Pago no completado</h1>
            <p className="text-muted-foreground mt-2">No se realizó ningún cargo. Puedes intentar de nuevo.</p>
          </>
        )}
      </div>

      {/* Order details */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Número de pedido</p>
            <p className="font-display font-bold text-lg font-mono">{order.order_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fecha</p>
            <p className="text-sm font-medium">{new Date(order.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Items */}
        <div className="px-6 py-4 border-b border-border space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Productos</p>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.name} <span className="text-xs">×{item.quantity}</span></span>
              <span className="font-medium">${(item.price * item.quantity).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between font-display font-bold">
            <span>Total</span>
            <span className="text-[#1E40AF]">${Number(order.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Contact & shipping */}
        <div className="px-6 py-4 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <span>{order.customer_email}</span>
          </div>
          {order.customer_phone && (
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{order.customer_phone}</span>
            </div>
          )}
          {order.shipping_method === "pickup" ? (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>Recoger en tienda · Mariano Escobedo 294-Pte, Culiacán</span>
            </div>
          ) : shippingAddr && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>{shippingAddr.street}, {shippingAddr.city}, {shippingAddr.state} {shippingAddr.zip}</span>
            </div>
          )}
          {order.factura_solicitada && (
            <div className="bg-amber-50 text-amber-800 text-xs rounded-lg px-3 py-2">
              Factura solicitada — la emitiremos en tienda y la enviaremos a tu correo.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link href="/" className="flex-1 text-center py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-surface transition-colors">
          Volver al inicio
        </Link>
        {isFailure && (
          <Link href="/carrito" className="flex-1 text-center py-2.5 rounded-xl bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1e3a8a] transition-colors">
            Intentar de nuevo
          </Link>
        )}
        {(isSuccess || isPending) && (
          <Link href="/productos" className="flex-1 text-center py-2.5 rounded-xl bg-[#1E40AF] text-white text-sm font-medium hover:bg-[#1e3a8a] transition-colors">
            Seguir comprando
          </Link>
        )}
      </div>
    </div>
  );
}
