import type { Metadata } from "next";
import { MapPin, Clock, Phone, Share2 } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "Más de 50 años vendiendo juguetes en Culiacán, Sinaloa. Conoce la historia de Juguetería El Arbolito.",
  openGraph: {
    title: "Nosotros | Juguetería El Arbolito",
    description: "Más de 50 años vendiendo juguetes en Culiacán, Sinaloa.",
  },
};

export default function NosotrosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-3">
        <p className="text-sm font-medium text-[#1E40AF] uppercase tracking-widest">Desde 1975</p>
        <h1 className="font-display font-bold text-3xl sm:text-4xl">Juguetería El Arbolito</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Más de 50 años llevando alegría a los niños de Culiacán y de todo México.
        </p>
      </div>

      {/* Historia */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8 space-y-4">
        <h2 className="font-display font-bold text-xl">Nuestra historia</h2>
        <p className="text-muted-foreground leading-relaxed">
          Juguetería El Arbolito nació en 1975 en el corazón de Culiacán, Sinaloa. Lo que comenzó como un pequeño local familiar creció hasta convertirse en una de las jugueterías más queridas y reconocidas de la región.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Durante décadas hemos sido parte de los recuerdos de generaciones de familias sinaloenses — los juguetes que esperaban en Navidad, los regalos de cumpleaños, los juegos que unían a familias enteras. Eso es lo que nos mueve a seguir.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Hoy combinamos nuestra tradición con una tienda en línea para llegar a más familias en todo México, con el mismo cariño y servicio de siempre.
        </p>
      </div>

      {/* Info de la tienda */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Visítanos</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <MapPin className="w-4 h-4 text-[#1E40AF] mt-0.5 shrink-0" />
              <span className="text-muted-foreground">Mariano Escobedo 294-Poniente, Primer Cuadro, Centro, 80000 Culiacán Rosales, Sinaloa.</span>
            </div>
            <div className="flex gap-3">
              <Clock className="w-4 h-4 text-[#1E40AF] mt-0.5 shrink-0" />
              <div className="text-muted-foreground">
                <p>Lunes a Viernes: 10:00 – 18:30</p>
                <p>Sábado: 10:00 – 18:00</p>
                <p className="text-xs mt-1">Domingo: cerrado</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Contáctanos</h2>
          <div className="space-y-3 text-sm">
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "526641234567"}?text=Hola, tengo una pregunta.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 hover:text-[#1E40AF] transition-colors"
            >
              <Phone className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">WhatsApp (próximamente)</span>
            </a>
            <a href="https://instagram.com/elarbolitotoys" target="_blank" rel="noopener noreferrer"
              className="flex gap-3 hover:text-[#1E40AF] transition-colors">
              <Share2 className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">Instagram: @elarbolitotoys</span>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
              className="flex gap-3 hover:text-[#1E40AF] transition-colors">
              <Share2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">Facebook: Juguetería El Arbolito</span>
            </a>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link href="/productos"
          className="inline-flex items-center gap-2 bg-[#1E40AF] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1e3a8a] transition-colors">
          Ver catálogo completo →
        </Link>
      </div>
    </div>
  );
}
