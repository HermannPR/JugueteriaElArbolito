"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight, Package } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { formatPrice, cn } from "@/lib/utils";

export default function CarritoPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-10 h-10 text-muted-foreground/40" />
        </div>
        <h1 className="font-display font-bold text-2xl mb-3">Tu carrito está vacío</h1>
        <p className="text-muted-foreground mb-8">
          Explora nuestro catálogo y agrega los juguetes que te gusten.
        </p>
        <Link href="/productos" className={cn(buttonVariants({ size: "lg" }), "bg-primary hover:bg-[var(--color-brand-dark)] font-semibold")}>
          Ver catálogo <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-8">Tu carrito</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => {
            const availableStock = Math.max(0, product.stock - product.stock_buffer);
            return (
              <div key={product.id} className="flex gap-4 p-4 bg-white rounded-2xl border border-border shadow-sm">
                <Link href={`/producto/${product.id}`} className="shrink-0">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface border border-border">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-contain p-1"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <Link href={`/producto/${product.id}`}>
                    <h3 className="font-display font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="font-display font-bold text-primary mt-1">
                    {formatPrice(product.price)}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-surface transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-surface transition-colors"
                        disabled={quantity >= availableStock}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-display font-bold">
                    {formatPrice(product.price * quantity)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="lg:col-span-1">
          <div className="bg-surface rounded-2xl border border-border p-6 sticky top-24">
            <h2 className="font-display font-bold text-lg mb-5">Resumen</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío</span>
                <span className="text-muted-foreground">Se calcula al pagar</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-display font-bold text-base">Total estimado</span>
                <span className="font-display font-bold text-base text-primary">{formatPrice(subtotal)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className={cn(buttonVariants({ size: "lg" }), "w-full mt-6 bg-primary hover:bg-[var(--color-brand-dark)] font-bold gap-2 justify-center")}
            >
              Ir a pagar <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/productos"
              className="block text-center text-sm text-muted-foreground hover:text-foreground mt-4 transition-colors"
            >
              ← Seguir comprando
            </Link>

            <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
              Pago seguro con Mercado Pago · Envíos a todo México
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
