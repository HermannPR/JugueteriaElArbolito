import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProductEditForm from "./ProductEditForm";
import type { Category } from "@/types";

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(id, name, emoji)")
    .eq("id", id)
    .single();
  return data;
}

async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("display_order");
  return data ?? [];
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), getCategories()]);
  if (!product) notFound();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Editar producto</h1>
        <p className="text-muted-foreground text-sm mt-1 font-mono">{product.eleventa_sku}</p>
      </div>
      <ProductEditForm product={product} categories={categories} />
    </div>
  );
}
