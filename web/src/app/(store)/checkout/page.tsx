"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShoppingCart, MapPin, CreditCard, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";

type Step = "contacto" | "entrega" | "factura" | "resumen";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "contacto", label: "Contacto", icon: ShoppingCart },
  { key: "entrega", label: "Entrega", icon: MapPin },
  { key: "factura", label: "Factura", icon: FileText },
  { key: "resumen", label: "Resumen", icon: CreditCard },
];

const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua",
  "Ciudad de México","Coahuila","Colima","Durango","Guanajuato","Guerrero","Hidalgo","Jalisco",
  "México","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro",
  "Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala",
  "Veracruz","Yucatán","Zacatecas",
];

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [step, setStep] = useState<Step>("contacto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [contacto, setContacto] = useState({ name: "", email: "", phone: "" });
  const [entrega, setEntrega] = useState({
    method: "envio" as "envio" | "pickup",
    street: "", city: "", state: "Sinaloa", zip: "", references: "",
  });
  const [factura, setFactura] = useState({
    solicitada: false,
    rfc: "", razon_social: "", uso_cfdi: "", email: "",
  });

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-lg font-display font-semibold mb-4">Tu carrito está vacío</p>
        <Link href="/productos" className="text-primary hover:underline text-sm">Ver catálogo →</Link>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function nextStep() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.key);
  }
  function prevStep() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.key);
  }

  function validateContact() {
    if (!contacto.name.trim()) { setError("Nombre requerido"); return false; }
    if (!contacto.email.trim() || !contacto.email.includes("@")) { setError("Correo inválido"); return false; }
    if (!contacto.phone.trim() || contacto.phone.replace(/\D/g, "").length < 10) { setError("Teléfono de 10 dígitos requerido"); return false; }
    return true;
  }

  function validateEntrega() {
    if (entrega.method === "envio") {
      if (!entrega.street.trim()) { setError("Calle y número requeridos"); return false; }
      if (!entrega.city.trim()) { setError("Ciudad requerida"); return false; }
      if (!entrega.zip.trim() || entrega.zip.replace(/\D/g, "").length < 5) { setError("Código postal inválido"); return false; }
    }
    return true;
  }

  function handleNext() {
    setError("");
    if (step === "contacto" && !validateContact()) return;
    if (step === "entrega" && !validateEntrega()) return;
    nextStep();
  }

  async function handlePay() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.product.id,
            name: i.product.name,
            price: i.product.price,
            quantity: i.quantity,
            image_url: i.product.image_url,
            eleventa_sku: i.product.eleventa_sku,
          })),
          customer: contacto,
          shipping_method: entrega.method,
          shipping_address: entrega.method === "envio" ? {
            street: entrega.street,
            city: entrega.city,
            state: entrega.state,
            zip: entrega.zip,
            references: entrega.references || undefined,
          } : undefined,
          factura_solicitada: factura.solicitada,
          datos_factura: factura.solicitada ? {
            rfc: factura.rfc,
            razon_social: factura.razon_social,
            uso_cfdi: factura.uso_cfdi,
            email: factura.email,
          } : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al procesar"); setLoading(false); return; }

      clearCart();
      window.location.href = data.init_point;
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl mb-6">Checkout</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = s.key === step;
          return (
            <div key={s.key} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                active ? "bg-[#1E40AF] text-white" : done ? "bg-green-100 text-green-700" : "bg-surface text-muted-foreground"
              }`}>
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
            {error && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

            {/* STEP: CONTACTO */}
            {step === "contacto" && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg">Datos de contacto</h2>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nombre completo</label>
                  <Input value={contacto.name} onChange={(e) => setContacto(c => ({ ...c, name: e.target.value }))} placeholder="Tu nombre" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Correo electrónico</label>
                  <Input type="email" value={contacto.email} onChange={(e) => setContacto(c => ({ ...c, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Teléfono (10 dígitos)</label>
                  <Input type="tel" value={contacto.phone} onChange={(e) => setContacto(c => ({ ...c, phone: e.target.value }))} placeholder="6671234567" maxLength={15} />
                </div>
              </div>
            )}

            {/* STEP: ENTREGA */}
            {step === "entrega" && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg">Método de entrega</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "envio", label: "Envío a domicilio", sub: "Todo México" },
                    { key: "pickup", label: "Recoger en tienda", sub: "Culiacán, Centro" },
                  ].map(({ key, label, sub }) => (
                    <button key={key} type="button"
                      onClick={() => setEntrega(e => ({ ...e, method: key as "envio" | "pickup" }))}
                      className={`p-4 rounded-xl border-2 text-left transition-colors ${entrega.method === key ? "border-[#1E40AF] bg-blue-50" : "border-border hover:border-[#1E40AF]/40"}`}
                    >
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </button>
                  ))}
                </div>

                {entrega.method === "envio" && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Calle y número</label>
                      <Input value={entrega.street} onChange={(e) => setEntrega(e_ => ({ ...e_, street: e.target.value }))} placeholder="Ej. Álvaro Obregón 123" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Ciudad</label>
                        <Input value={entrega.city} onChange={(e) => setEntrega(e_ => ({ ...e_, city: e.target.value }))} placeholder="Culiacán" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Código postal</label>
                        <Input value={entrega.zip} onChange={(e) => setEntrega(e_ => ({ ...e_, zip: e.target.value }))} placeholder="80000" maxLength={5} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Estado</label>
                      <select value={entrega.state} onChange={(e) => setEntrega(e_ => ({ ...e_, state: e.target.value }))}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]">
                        {ESTADOS_MX.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Referencias <span className="text-muted-foreground font-normal">(opcional)</span></label>
                      <Input value={entrega.references} onChange={(e) => setEntrega(e_ => ({ ...e_, references: e.target.value }))} placeholder="Entre calles, color de casa..." />
                    </div>
                  </div>
                )}

                {entrega.method === "pickup" && (
                  <div className="bg-surface rounded-xl p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Juguetería El Arbolito</p>
                    <p>Mariano Escobedo 294-Pte, Centro, Culiacán</p>
                    <p className="mt-1">Lun–Vie: 10:00–18:30 · Sáb: 10:00–18:00</p>
                    <p className="mt-2 text-xs">Recibirás un correo cuando tu pedido esté listo para recoger.</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP: FACTURA */}
            {step === "factura" && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg">¿Necesitas factura?</h2>
                <p className="text-sm text-muted-foreground">La factura se emite manualmente en tienda. Solo marca si la necesitas y llenaremos tus datos.</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={factura.solicitada} onChange={(e) => setFactura(f => ({ ...f, solicitada: e.target.checked }))}
                    className="w-5 h-5 accent-[#1E40AF] rounded" />
                  <span className="font-medium">Sí, necesito factura</span>
                </label>
                {factura.solicitada && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">RFC</label>
                      <Input value={factura.rfc} onChange={(e) => setFactura(f => ({ ...f, rfc: e.target.value.toUpperCase() }))} placeholder="XAXX010101000" maxLength={13} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Razón social</label>
                      <Input value={factura.razon_social} onChange={(e) => setFactura(f => ({ ...f, razon_social: e.target.value }))} placeholder="Nombre o empresa" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Uso de CFDI</label>
                      <select value={factura.uso_cfdi} onChange={(e) => setFactura(f => ({ ...f, uso_cfdi: e.target.value }))}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]">
                        <option value="">Seleccionar...</option>
                        <option value="G01">G01 - Adquisición de mercancias</option>
                        <option value="G03">G03 - Gastos en general</option>
                        <option value="D10">D10 - Pagos por servicios educativos</option>
                        <option value="S01">S01 - Sin efectos fiscales</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Correo para la factura</label>
                      <Input type="email" value={factura.email} onChange={(e) => setFactura(f => ({ ...f, email: e.target.value }))} placeholder="factura@empresa.com" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP: RESUMEN */}
            {step === "resumen" && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg">Confirma tu pedido</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nombre</span><span className="font-medium">{contacto.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Correo</span><span>{contacto.email}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Teléfono</span><span>{contacto.phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span>
                    <span className="font-medium">{entrega.method === "pickup" ? "Recoger en tienda" : `Envío · ${entrega.city}, ${entrega.state}`}</span>
                  </div>
                  {factura.solicitada && <div className="flex justify-between"><span className="text-muted-foreground">Factura</span><span className="font-medium text-amber-700">Solicitada · {factura.rfc}</span></div>}
                </div>
                <div className="border-t border-border pt-3 space-y-1 text-sm">
                  {items.map((i) => (
                    <div key={i.product.id} className="flex justify-between">
                      <span className="text-muted-foreground">{i.product.name.slice(0, 40)}{i.product.name.length > 40 ? "…" : ""} ×{i.quantity}</span>
                      <span>{formatPrice(i.product.price * i.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-800 mt-2">
                  El costo de envío se cotiza según tu ubicación y se coordina por correo o WhatsApp.
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex justify-between mt-6 pt-4 border-t border-border">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" onClick={prevStep} disabled={loading}>← Atrás</Button>
              ) : (
                <Link href="/carrito" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← Carrito</Link>
              )}
              {step === "resumen" ? (
                <Button onClick={handlePay} disabled={loading} className="bg-[#1E40AF] hover:bg-[#1e3a8a] gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : <><CreditCard className="w-4 h-4" /> Pagar con Mercado Pago</>}
                </Button>
              ) : (
                <Button onClick={handleNext} className="bg-[#1E40AF] hover:bg-[#1e3a8a]">
                  Continuar →
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 sticky top-24">
            <h3 className="font-display font-semibold mb-4">Tu pedido</h3>
            <div className="space-y-3 text-sm max-h-64 overflow-y-auto pr-1">
              {items.map((i) => (
                <div key={i.product.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground line-clamp-2 flex-1">{i.product.name} <span className="text-xs">×{i.quantity}</span></span>
                  <span className="font-medium shrink-0">{formatPrice(i.product.price * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Envío</span><span className="text-muted-foreground">{entrega.method === "pickup" ? "Gratis" : "A calcular"}</span></div>
              <div className="flex justify-between font-display font-bold text-base pt-1">
                <span>Total</span><span className="text-[#1E40AF]">{formatPrice(subtotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
