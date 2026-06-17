import type { Metadata } from "next";
import { Package, MapPin, Clock, Truck, Store } from "lucide-react";

export const metadata: Metadata = {
  title: "Envíos y Entregas",
  description: "Enviamos a todo México. Conoce nuestras opciones de envío y cómo funciona la entrega de tu pedido.",
};

export default function EnviosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="font-display font-bold text-3xl">Envíos y Entregas</h1>
        <p className="text-muted-foreground">Llevamos tus juguetes favoritos a cualquier parte de México.</p>
      </div>

      {/* Opciones de entrega */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-[#1E40AF]" />
          </div>
          <h2 className="font-display font-bold text-lg">Envío a domicilio</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enviamos a todo México por paquetería. El costo varía según tu código postal y el peso del pedido. Te confirmamos el costo exacto por correo o WhatsApp antes de procesar el envío.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 pt-1">
            <li className="flex gap-2"><Package className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" /> Paquetería: Estafeta, FedEx, Paquetexpress u otras.</li>
            <li className="flex gap-2"><Clock className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" /> Tiempo de entrega: 2–7 días hábiles según destino.</li>
            <li className="flex gap-2"><MapPin className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" /> Alcance: toda la República Mexicana.</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Store className="w-5 h-5 text-green-700" />
          </div>
          <h2 className="font-display font-bold text-lg">Recoger en tienda</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sin costo de envío. Pasa a recoger tu pedido directamente en nuestra tienda en el Centro de Culiacán.
          </p>
          <div className="text-sm text-muted-foreground space-y-1.5 pt-1">
            <p className="font-medium text-foreground">Juguetería El Arbolito</p>
            <p>Mariano Escobedo 294-Pte, Centro, Culiacán.</p>
            <p>Lun–Vie: 10:00–18:30 · Sáb: 10:00–18:00</p>
            <p className="text-xs mt-2">Te avisamos por correo cuando tu pedido esté listo para recoger.</p>
          </div>
        </div>
      </div>

      {/* Proceso */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8 space-y-4">
        <h2 className="font-display font-bold text-xl">¿Cómo funciona?</h2>
        <ol className="space-y-4 text-sm">
          {[
            ["Haces tu pedido", "Agrega productos al carrito, completa el checkout y realiza tu pago por Mercado Pago (tarjeta, OXXO o SPEI)."],
            ["Confirmamos tu pedido", "Recibirás un correo con el resumen. Si elegiste envío, te confirmamos el costo de paquetería y lo coordinamos contigo."],
            ["Preparamos y enviamos", "Empacamos tu pedido con cuidado y lo entregamos a la paquetería. Te compartimos el número de rastreo."],
            ["Llega a tu puerta", "Recibes tu pedido en la dirección que indicaste. Para recoger en tienda, te avisamos cuando esté listo."],
          ].map(([title, desc], i) => (
            <li key={i} className="flex gap-4">
              <span className="w-6 h-6 rounded-full bg-[#1E40AF] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Notas */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-sm text-amber-900 space-y-2">
        <p className="font-semibold">Importante</p>
        <ul className="space-y-1 list-disc list-inside text-amber-800">
          <li>El envío se cotiza después de que realizas el pago.</li>
          <li>Productos voluminosos (montables, casas de juguete) pueden requerir flete especial.</li>
          <li>No realizamos envíos internacionales.</li>
          <li>No aceptamos devoluciones. Revisa bien tu pedido antes de confirmar.</li>
        </ul>
      </div>
    </div>
  );
}
