import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/catalog/ProductCard";
import type { Product, Category } from "@/types";

async function getCategory(slug: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data;
}

async function getProducts(categoryId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name,slug,emoji,color)")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .eq("is_approved", true)
    .gt("stock", 0)
    .order("name")
    .limit(48);
  return (data as Product[]) ?? [];
}

export default async function CategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const products = await getProducts(category.id);

  return (
    <div>
      {/* Header de categoría */}
      <div className="relative h-56 sm:h-72 text-white overflow-hidden">
        {category.image_url ? (
          <Image
            src={category.image_url}
            alt={category.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${category.color}dd, ${category.color}99)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-8">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl drop-shadow-lg">{category.name}</h1>
          <p className="text-white/90 mt-2 drop-shadow">
            {products.length} producto{products.length !== 1 ? "s" : ""} disponible{products.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {products.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg font-display font-semibold">Sin productos disponibles</p>
            <p className="text-sm mt-1">Pronto habrá novedades en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
