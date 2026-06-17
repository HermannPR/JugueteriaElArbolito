import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import ProductCard from "@/components/catalog/ProductCard";
import AddToCartButton from "@/components/catalog/AddToCartButton";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name,slug,emoji,color), subcategories(name,slug)")
    .eq("id", id)
    .eq("is_active", true)
    .eq("is_approved", true)
    .single();
  return data as Product | null;
}

async function getRelated(product: Product): Promise<Product[]> {
  if (!product.category_id) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name,slug,emoji,color)")
    .eq("category_id", product.category_id)
    .eq("is_active", true)
    .eq("is_approved", true)
    .gt("stock", 0)
    .neq("id", product.id)
    .limit(4);
  return (data as Product[]) ?? [];
}

export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const related = await getRelated(product);
  const availableStock = Math.max(0, product.stock - (product.stock_buffer ?? 0));
  const hasDiscount = product.old_price && product.old_price > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.old_price! - product.price) / product.old_price!) * 100)
    : 0;

  const images = product.image_urls?.length
    ? product.image_urls
    : product.image_url
    ? [product.image_url]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:text-foreground transition-colors">Catálogo</Link>
        {product.categories && (
          <>
            <span>/</span>
            <Link
              href={`/categoria/${product.categories.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {product.categories.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Imagen */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-surface border border-border">
          {images.length > 0 ? (
            <Image
              src={images[0]}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6"
              priority
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Package className="w-20 h-20 opacity-20" />
              <p className="text-sm opacity-50">Sin imagen disponible</p>
            </div>
          )}
          {hasDiscount && (
            <Badge className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-base font-bold px-3 py-1">
              -{discountPct}%
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          {product.categories && (
            <Link
              href={`/categoria/${product.categories.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium w-fit"
              style={{ color: product.categories.color }}
            >
              {product.categories.emoji} {product.categories.name}
              {product.subcategories && (
                <span className="text-muted-foreground">› {product.subcategories.name}</span>
              )}
            </Link>
          )}

          <h1 className="font-display font-bold text-2xl sm:text-3xl leading-snug">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-3">
            <span className="font-display font-extrabold text-3xl text-primary">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xl text-muted-foreground line-through">
                {formatPrice(product.old_price!)}
              </span>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${availableStock > 0 ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-sm text-muted-foreground">
              {availableStock > 0
                ? `${availableStock} disponible${availableStock !== 1 ? "s" : ""}`
                : "Sin stock"}
            </span>
          </div>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          <AddToCartButton product={product} availableStock={availableStock} />

          {/* SKU */}
          <p className="text-xs text-muted-foreground">
            SKU: {product.eleventa_sku}
          </p>
        </div>
      </div>

      {/* Relacionados */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display font-bold text-xl mb-6">
            También te puede gustar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
