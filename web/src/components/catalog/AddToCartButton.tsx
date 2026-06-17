"use client";

import { useState } from "react";
import { ShoppingCart, Plus, Minus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/types";

interface Props {
  product: Product;
  availableStock: number;
}

export default function AddToCartButton({ product, availableStock }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  function handleAdd() {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock: product.stock,
      stock_buffer: product.stock_buffer,
      eleventa_sku: product.eleventa_sku,
    }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (availableStock === 0) {
    return (
      <Button size="lg" disabled className="w-full">
        Sin stock disponible
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Cantidad:</span>
        <div className="flex items-center border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-surface transition-colors"
            disabled={quantity <= 1}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center font-display font-semibold">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
            className="w-10 h-10 flex items-center justify-center hover:bg-surface transition-colors"
            disabled={quantity >= availableStock}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Button
        size="lg"
        className={`w-full gap-2 font-semibold transition-all ${
          added
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-primary hover:bg-[var(--color-brand-dark)]"
        }`}
        onClick={handleAdd}
      >
        {added ? (
          <>
            <Check className="w-5 h-5" /> ¡Agregado al carrito!
          </>
        ) : (
          <>
            <ShoppingCart className="w-5 h-5" /> Agregar al carrito
          </>
        )}
      </Button>
    </div>
  );
}
