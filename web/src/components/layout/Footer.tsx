import Link from "next/link";
import { TreePine, MapPin, Clock, Share2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#1E40AF] text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Marca */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <TreePine className="w-5 h-5" />
              </div>
              <div>
                <p className="font-display font-bold text-lg leading-none">El Arbolito</p>
                <p className="text-white/60 text-xs">Desde 1975</p>
              </div>
            </div>
            <p className="text-white/70 text-sm">
              Tu juguetería de confianza en Culiacán. Más de 2,000 juguetes para todas las edades.
            </p>
            <div className="flex gap-3">
              <a href="https://instagram.com/elarbolitotoys" target="_blank" rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors text-xs font-medium flex items-center gap-1">
                <Share2 className="w-4 h-4" /> Instagram
              </a>
              <a href="https://facebook.com/JugueteriaElArbolito" target="_blank" rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors text-xs font-medium flex items-center gap-1">
                <Share2 className="w-4 h-4" /> Facebook
              </a>
            </div>
          </div>

          {/* Categorías */}
          <div>
            <h3 className="font-display font-semibold mb-4">Categorías</h3>
            <ul className="space-y-2 text-sm text-white/70">
              {[
                { href: "/categoria/didacticos", label: "Didácticos" },
                { href: "/categoria/munecas-y-bebes", label: "Muñecas y bebés" },
                { href: "/categoria/deportes", label: "Deportes" },
                { href: "/categoria/dinosaurios", label: "Dinosaurios" },
                { href: "/categoria/libros", label: "Libros" },
                { href: "/categoria/coleccionables", label: "Coleccionables" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="font-display font-semibold mb-4">Información</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/nosotros" className="hover:text-white transition-colors">Acerca de nosotros</Link></li>
              <li><Link href="/envios" className="hover:text-white transition-colors">Envíos a todo México</Link></li>
              <li><Link href="/politicas" className="hover:text-white transition-colors">Políticas de venta</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">Preguntas frecuentes</Link></li>
              <li><Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link></li>
            </ul>
          </div>

          {/* Ubicación */}
          <div>
            <h3 className="font-display font-semibold mb-4">Visítanos</h3>
            <div className="space-y-3 text-sm text-white/70">
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Mariano Escobedo 294-Pte, Centro, 80000 Culiacán Rosales, Sin.</span>
              </div>
              <div className="flex gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>Lun–Vie: 10:00–18:30</p>
                  <p>Sáb: 10:00–18:00</p>
                  <p>Dom: Cerrado</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-white/50">
          <p>© {new Date().getFullYear()} Juguetería El Arbolito. Todos los derechos reservados.</p>
          <p>Envíos a todo México · Sin devoluciones · Facturación en tienda</p>
        </div>
      </div>
    </footer>
  );
}
