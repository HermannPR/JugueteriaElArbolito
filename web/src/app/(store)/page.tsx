import Link from "next/link";
import { ArrowRight, Package, Truck, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProductCard from "@/components/catalog/ProductCard";
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
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#1E40AF] via-[#1e3a8a] to-[#0f2472] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-20 w-60 h-60 rounded-full bg-accent/30 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-sm font-medium px-3 py-1 rounded-full mb-6">
              🎄 Juguetería El Arbolito · Desde 1975
            </div>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight mb-6">
              Juguetes para{" "}
              <span className="text-yellow-300">todos</span>{" "}
              los momentos
            </h1>
            <p className="text-white/80 text-lg sm:text-xl mb-8 leading-relaxed">
              Más de 2,000 juguetes seleccionados. Envíos a todo México desde nuestra tienda en Culiacán.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/productos" className={cn(buttonVariants({ size: "lg" }), "bg-white text-primary hover:bg-white/90 font-bold shadow-lg")}>
                Ver catálogo <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <Link href="/nosotros" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "border-white/40 text-white hover:bg-white/10 font-semibold")}>
                Nuestra historia
              </Link>
            </div>
          </div>
        </div>
      </section>

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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.slug}`}
              className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-border"
            >
              <span
                className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                {cat.emoji}
              </span>
              <span className="text-xs font-display font-semibold text-center leading-tight">
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
            <h2 className="font-display font-bold text-2xl sm:text-3xl">⭐ Destacados</h2>
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
              <h2 className="font-display font-bold text-2xl sm:text-3xl">🆕 Novedades</h2>
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
            ¿Prefieres visitarnos? 🎄
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
