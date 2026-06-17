import Link from "next/link";
import Image from "next/image";
import { Package, Truck, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/catalog/ProductCard";
import HeroCarousel from "@/components/home/HeroCarousel";
import { lifestyleImages } from "@/lib/lifestyle-images";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/types";

async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  return data ?? [];
}

async function getFeaturedProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name,slug,emoji,color)")
    .eq("is_active", true)
    .eq("is_approved", true)
    .eq("is_featured", true)
    .gt("stock", 0)
    .limit(8);
  return (data as Product[]) ?? [];
}

async function getRecentProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name,slug,emoji,color)")
    .eq("is_active", true)
    .eq("is_approved", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data as Product[]) ?? [];
}

export default async function HomePage() {
  const [categories, featured, recent] = await Promise.all([
    getCategories(),
    getFeaturedProducts(),
    getRecentProducts(),
  ]);

  return (
    <div>
      {/* Hero carousel */}
      <HeroCarousel images={lifestyleImages} />

      {/* Ventajas */}
      <section className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Truck, title: "Envíos a todo México", desc: "Múltiples paqueterías disponibles" },
              { icon: Package, title: "+2,000 productos", desc: "Juguetes para todas las edades" },
              { icon: ShieldCheck, title: "Compra segura", desc: "Pago con Mercado Pago" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">{title}</p>
                  <p className="text-muted-foreground text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-2xl sm:text-3xl">Categorías</h2>
          <Link href="/productos" className="text-sm text-primary hover:underline font-medium">
            Ver todo →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.slug}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              {cat.image_url ? (
                <Image
                  src={cat.image_url}
                  alt={cat.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <span
                  className="absolute inset-0 flex items-center justify-center text-5xl"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  {cat.emoji}
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 text-white font-display font-bold text-base sm:text-lg leading-tight drop-shadow">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Productos destacados */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-2xl sm:text-3xl">Destacados</h2>
            <Link href="/productos?destacados=1" className="text-sm text-primary hover:underline font-medium">
              Ver más →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Recientes / novedades */}
      {recent.length > 0 && (
        <section className="bg-surface py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-2xl sm:text-3xl">Novedades</h2>
              <Link href="/productos?orden=nuevos" className="text-sm text-primary hover:underline font-medium">
                Ver más →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {recent.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA tienda física */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] p-8 sm:p-12 text-white text-center">
          <h2 className="font-display font-bold text-3xl sm:text-4xl mb-3">
            ¿Prefieres visitarnos?
          </h2>
          <p className="text-white/80 text-lg mb-6">
            Mariano Escobedo 294-Pte, Centro, Culiacán · Lun–Vie 10–18:30 · Sáb 10–18
          </p>
          <Link href="/contacto" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-white/90 font-bold")}>
            Cómo llegar
          </Link>
        </div>
      </section>
    </div>
  );
}
