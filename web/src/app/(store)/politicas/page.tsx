import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Políticas de Compra",
  description: "Conoce nuestras políticas de compra, envío, pagos y privacidad en Juguetería El Arbolito.",
};

export default function PoliticasPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="font-display font-bold text-3xl">Políticas de Compra</h1>
        <p className="text-muted-foreground text-sm">Última actualización: junio 2026</p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-foreground">1. Pagos</h2>
          <p>Aceptamos pagos a través de <strong className="text-foreground">Mercado Pago</strong>, que incluye:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Tarjeta de crédito o débito (Visa, Mastercard, American Express).</li>
            <li>Pago en efectivo en OXXO (genera un voucher válido por 72 horas).</li>
            <li>Transferencia SPEI.</li>
          </ul>
          <p>No ofrecemos meses sin intereses por parte de la tienda. El cliente puede diferir el pago con su banco directamente; los intereses generados son responsabilidad del banco y el cliente.</p>
          <p>Todos los precios están expresados en pesos mexicanos (MXN) e incluyen IVA.</p>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-foreground">2. Envíos</h2>
          <p>Enviamos a toda la República Mexicana por paquetería. El costo de envío se calcula según el destino y el peso del pedido, y se confirma por correo electrónico o WhatsApp una vez procesado el pago.</p>
          <p>El tiempo estimado de entrega es de <strong className="text-foreground">2 a 7 días hábiles</strong> dependiendo de la paquetería y el destino. Los tiempos pueden variar en temporadas de alta demanda (Navidad, Día del Niño).</p>
          <p>También ofrecemos la opción de <strong className="text-foreground">recoger en tienda</strong> sin costo adicional en nuestro local de Culiacán.</p>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-foreground">3. Devoluciones y Cancelaciones</h2>
          <p className="text-red-700 font-medium">No aceptamos devoluciones ni cambios de productos.</p>
          <p>Te recomendamos revisar cuidadosamente la descripción del producto antes de comprar. Si tienes dudas, contáctanos antes de realizar tu pedido y con gusto te asesoramos.</p>
          <p>Si tu pedido llegó dañado por la paquetería, contáctanos por WhatsApp dentro de las <strong className="text-foreground">24 horas</strong> posteriores a la recepción con fotografías del empaque y el producto, y evaluaremos tu caso.</p>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-foreground">4. Facturación</h2>
          <p>Si necesitas factura, indícalo al momento de realizar tu pedido marcando la casilla correspondiente en el checkout. La factura se emite manualmente en nuestra tienda física.</p>
          <p>Para solicitar factura de un pedido ya realizado, contáctanos por WhatsApp con tu número de pedido (formato ARB-XXXXXXXX-XXXXX) y tus datos fiscales (RFC, razón social, uso de CFDI, correo).</p>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-foreground">5. Privacidad y Datos Personales</h2>
          <p>Los datos personales que nos proporcionas (nombre, correo, teléfono, dirección) se utilizan exclusivamente para procesar tu pedido y comunicarnos contigo sobre el mismo.</p>
          <p>No compartimos tus datos con terceros, salvo con las paqueterías necesarias para realizar el envío y con Mercado Pago para procesar el pago.</p>
          <p>Tus datos de pago son procesados directamente por Mercado Pago. Juguetería El Arbolito no almacena información de tarjetas de crédito o débito.</p>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-display font-bold text-lg text-foreground">6. Disponibilidad de Productos</h2>
          <p>El stock mostrado en la tienda en línea se actualiza periódicamente según nuestro inventario físico. En caso excepcional de que un producto no esté disponible después de tu compra, te contactaremos para ofrecerte una alternativa o realizar el reembolso correspondiente.</p>
        </section>
      </div>
    </div>
  );
}
