"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Product } from "@/types";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/utils";

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const { addItem } = useCart();
  const availableStock = Math.max(0, product.stock - (product.stock_buffer ?? 0));
  const hasDiscount = product.old_price && product.old_price > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.old_price! - product.price) / product.old_price!) * 100)
    : 0;

  return (
    <Card className="group overflow-hidden border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
      <Link href={`/producto/${product.id}`} className="relative block aspect-square overflow-hidden bg-surface">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package className="w-12 h-12 opacity-30" />
            <span className="text-xs text-center px-2 opacity-50">{product.name}</span>
          </div>
        )}
        {hasDiscount && (
          <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground font-bold">
            -{discountPct}%
          </Badge>
        )}
        {product.is_featured && !hasDiscount && (
          <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground">
            Destacado
          </Badge>
        )}
      </Link>

      <CardContent className="p-3 flex flex-col flex-1 gap-2">
        {product.categories && (
          <span
            className="text-xs font-medium"
            style={{ color: product.categories.color }}
          >
            {product.categories.emoji} {product.categories.name}
          </span>
        )}

        <Link href={`/producto/${product.id}`} className="flex-1">
          <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-lg text-primary">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.old_price!)}
            </span>
          )}
        </div>

        <Button
          size="sm"
          className="w-full bg-primary hover:bg-[var(--color-brand-dark)] gap-2 font-semibold"
          onClick={() => addItem({
            id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            stock: product.stock,
            stock_buffer: product.stock_buffer,
            eleventa_sku: product.eleventa_sku,
          })}
          disabled={availableStock === 0}
        >
          <ShoppingCart className="w-4 h-4" />
          {availableStock === 0 ? "Sin stock" : "Agregar"}
        </Button>
      </CardContent>
    </Card>
  );
}
