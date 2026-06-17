import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Preguntas Frecuentes",
  description: "Resolvemos tus dudas sobre envíos, pagos, pedidos y productos en Juguetería El Arbolito.",
};

const FAQS = [
  {
    category: "Pedidos",
    items: [
      {
        q: "¿Cómo hago un pedido?",
        a: "Agrega los productos que quieras al carrito y sigue el proceso de checkout. Te pediremos tus datos de contacto y entrega, y podrás pagar de forma segura con Mercado Pago.",
      },
      {
        q: "¿Puedo modificar o cancelar mi pedido?",
        a: "Una vez realizado el pago, el pedido entra a proceso de preparación. Contáctanos de inmediato por WhatsApp con tu número de pedido y haremos lo posible por atenderte, aunque no podemos garantizarlo si ya fue enviado.",
      },
      {
        q: "¿Cómo sé que mi pedido fue recibido?",
        a: "Después de pagar, serás redirigido a una página de confirmación con tu número de pedido. También puedes consultarlo en elarbolitotoys.mx/pedido/[tu-número-de-pedido].",
      },
      {
        q: "¿Puedo pedir sin tener cuenta?",
        a: "Sí. No necesitas crear una cuenta para comprar. Solo necesitas tu correo electrónico para recibir la confirmación.",
      },
    ],
  },
  {
    category: "Pagos",
    items: [
      {
        q: "¿Qué métodos de pago aceptan?",
        a: "Aceptamos tarjeta de crédito/débito, pago en OXXO y transferencia SPEI, todos a través de Mercado Pago.",
      },
      {
        q: "¿Ofrecen meses sin intereses?",
        a: "No ofrecemos meses sin intereses de nuestra parte. Puedes diferir tu pago directamente con tu banco, pero los intereses corren por tu cuenta.",
      },
      {
        q: "¿Es seguro pagar en la tienda?",
        a: "Sí. El pago se procesa directamente en la plataforma segura de Mercado Pago. Nosotros no almacenamos datos de tarjetas.",
      },
      {
        q: "Pagué en OXXO, ¿cuándo se confirma mi pedido?",
        a: "Los pagos en OXXO pueden tardarse hasta 72 horas en reflejarse. Una vez confirmado, tu pedido entra a proceso de preparación.",
      },
    ],
  },
  {
    category: "Envíos",
    items: [
      {
        q: "¿Cuánto cuesta el envío?",
        a: "El costo varía según tu código postal y el peso del pedido. Te lo confirmamos por correo o WhatsApp después de que realizas tu compra.",
      },
      {
        q: "¿En cuánto tiempo llega mi pedido?",
        a: "Generalmente entre 2 y 7 días hábiles dependiendo de la paquetería y tu ubicación. En temporadas altas (Navidad, Día del Niño) puede tardar un poco más.",
      },
      {
        q: "¿Puedo recoger en tienda?",
        a: "Sí, sin costo adicional. Selecciona 'Recoger en tienda' en el checkout. Te avisamos por correo cuando tu pedido esté listo. Lunes a Viernes 10–18:30, Sábado 10–18:00.",
      },
      {
        q: "¿Envían fuera de México?",
        a: "Por el momento solo enviamos dentro de la República Mexicana.",
      },
    ],
  },
  {
    category: "Productos",
    items: [
      {
        q: "¿Todos los productos tienen garantía?",
        a: "Los productos de marca tienen la garantía del fabricante. Para reportar un defecto de fábrica, contáctanos con tu comprobante de compra.",
      },
      {
        q: "¿Hacen devoluciones o cambios?",
        a: "No aceptamos devoluciones ni cambios. Te recomendamos revisar bien la descripción antes de comprar. Si tienes dudas, contáctanos antes.",
      },
      {
        q: "¿El stock en línea es el mismo que en tienda física?",
        a: "Sí, manejamos un solo inventario compartido entre la tienda física y la tienda en línea, por lo que el stock siempre está actualizado.",
      },
    ],
  },
  {
    category: "Facturación",
    items: [
      {
        q: "¿Pueden facturar mi compra?",
        a: "Sí. Marca la opción 'Necesito factura' durante el checkout, o contáctanos por WhatsApp con tu número de pedido y datos fiscales (RFC, razón social, uso de CFDI). La factura se emite manualmente en tienda.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="font-display font-bold text-3xl">Preguntas Frecuentes</h1>
        <p className="text-muted-foreground">¿No encuentras lo que buscas? <Link href="/contacto" className="text-[#1E40AF] hover:underline">Contáctanos</Link>.</p>
      </div>

      <div className="space-y-8">
        {FAQS.map(({ category, items }) => (
          <div key={category}>
            <h2 className="font-display font-bold text-lg mb-4 text-[#1E40AF]">{category}</h2>
            <div className="space-y-3">
              {items.map(({ q, a }) => (
                <details key={q} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden group">
                  <summary className="px-5 py-4 font-medium text-sm cursor-pointer flex items-center justify-between gap-4 list-none select-none">
                    {q}
                    <span className="text-muted-foreground group-open:rotate-45 transition-transform shrink-0 text-lg">+</span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                    {a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
