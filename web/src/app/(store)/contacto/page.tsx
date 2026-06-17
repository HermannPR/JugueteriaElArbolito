import type { Metadata } from "next";
import { MapPin, Clock, Share2, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contáctanos por WhatsApp, redes sociales o visítanos en nuestra tienda en Culiacán, Sinaloa.",
};

const WA_URL = `https://wa.me/526641234567?text=${encodeURIComponent("Hola, tengo una pregunta.")}`;

export default function ContactoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="font-display font-bold text-3xl">Contáctanos</h1>
        <p className="text-muted-foreground">Estamos para ayudarte. Escríbenos y te respondemos a la brevedad.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* WhatsApp */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center space-y-3 hover:border-green-400 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <MessageCircle className="w-6 h-6 text-green-700" />
          </div>
          <div>
            <p className="font-display font-bold text-base">WhatsApp</p>
            <p className="text-sm text-muted-foreground mt-1">La forma más rápida. Respondemos en horario de tienda.</p>
          </div>
          <span className="text-sm font-semibold text-green-700 bg-green-100 px-4 py-1.5 rounded-full">Enviar mensaje →</span>
        </a>

        {/* Instagram */}
        <a
          href="https://instagram.com/elarbolitotoys"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center space-y-3 hover:border-pink-400 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center group-hover:bg-pink-200 transition-colors">
            <Share2 className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <p className="font-display font-bold text-base">Instagram</p>
            <p className="text-sm text-muted-foreground mt-1">Síguenos y mándanos un DM por Instagram.</p>
          </div>
          <span className="text-sm font-semibold text-pink-700 bg-pink-100 px-4 py-1.5 rounded-full">@elarbolitotoys →</span>
        </a>

        {/* Facebook */}
        <a
          href="https://facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center space-y-3 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Share2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-display font-bold text-base">Facebook</p>
            <p className="text-sm text-muted-foreground mt-1">Encuéntranos en Facebook como Juguetería El Arbolito.</p>
          </div>
          <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-4 py-1.5 rounded-full">Ver página →</span>
        </a>

        {/* Tienda */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-amber-700" />
          </div>
          <div className="space-y-2">
            <p className="font-display font-bold text-base">Visítanos</p>
            <p className="text-sm text-muted-foreground">Mariano Escobedo 294-Pte, Centro, Culiacán, Sin.</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Lun–Vie 10–18:30 · Sáb 10–18:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nota pedidos */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-900">
        <p className="font-semibold mb-1">¿Tienes una pregunta sobre un pedido?</p>
        <p>Escríbenos por WhatsApp con tu número de pedido (formato <span className="font-mono">ARB-XXXXXXXX-XXXXX</span>) y te ayudamos de inmediato. También puedes usar el chatbot de esta página.</p>
      </div>
    </div>
  );
}
