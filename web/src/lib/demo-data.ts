import type { Category, Product } from "@/types";

/** Offline demo mode: kicks in when Supabase env vars are absent, so the
 *  public preview renders realistic toy-store content instead of crashing. */
export function isDemoMode(): boolean {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export const demoCategories: Category[] = [
  { id: "demo-munecas", name: "Muñecas", slug: "munecas", emoji: "🧸", color: "#f472b6", display_order: 1, is_active: true, image_url: null },
  { id: "demo-bloques", name: "Bloques", slug: "bloques", emoji: "🧩", color: "#38bdf8", display_order: 2, is_active: true, image_url: null },
  { id: "demo-educativos", name: "Juguetes educativos", slug: "juguetes-educativos", emoji: "🎓", color: "#a3e635", display_order: 3, is_active: true, image_url: null },
];

const now = new Date().toISOString();
const cat = (id: string): Pick<Category, "name" | "slug" | "emoji" | "color"> => {
  const c = demoCategories.find((c) => c.id === id)!;
  return { name: c.name, slug: c.slug, emoji: c.emoji, color: c.color };
};

export const demoProducts: Product[] = [
  { id: "demo-p1", name: "Osito de peluche", description: "Peluche suave de 30 cm.", price: 249, old_price: 299, image_url: null, image_urls: null, stock: 24, stock_buffer: 6, is_featured: true, is_active: true, is_approved: true, eleventa_sku: "DEMO-001", category_id: "demo-munecas", subcategory_id: null, weight: null, created_at: now, updated_at: now, categories: cat("demo-munecas") },
  { id: "demo-p2", name: "Muñeca sonriente", description: "Muñeca clásica de 25 cm.", price: 199, old_price: null, image_url: null, image_urls: null, stock: 18, stock_buffer: 4, is_featured: true, is_active: true, is_approved: true, eleventa_sku: "DEMO-002", category_id: "demo-munecas", subcategory_id: null, weight: null, created_at: now, updated_at: now, categories: cat("demo-munecas") },
  { id: "demo-p3", name: "Torre de bloques 120 pzas", description: "Set de bloques de plástico.", price: 449, old_price: 499, image_url: null, image_urls: null, stock: 12, stock_buffer: 3, is_featured: true, is_active: true, is_approved: true, eleventa_sku: "DEMO-003", category_id: "demo-bloques", subcategory_id: null, weight: null, created_at: now, updated_at: now, categories: cat("demo-bloques") },
  { id: "demo-p4", name: "Kit de matemáticas", description: "Ábaco + tarjetas de números.", price: 329, old_price: null, image_url: null, image_urls: null, stock: 9, stock_buffer: 2, is_featured: true, is_active: true, is_approved: true, eleventa_sku: "DEMO-004", category_id: "demo-educativos", subcategory_id: null, weight: null, created_at: now, updated_at: now, categories: cat("demo-educativos") },
  { id: "demo-p5", name: "Robot de armado", description: "Robot educativo para armar.", price: 699, old_price: 799, image_url: null, image_urls: null, stock: 6, stock_buffer: 2, is_featured: false, is_active: true, is_approved: true, eleventa_sku: "DEMO-005", category_id: "demo-educativos", subcategory_id: null, weight: null, created_at: now, updated_at: now, categories: cat("demo-educativos") },
  { id: "demo-p6", name: "Coche de juguete", description: "Coche a escala 1:24.", price: 289, old_price: null, image_url: null, image_urls: null, stock: 20, stock_buffer: 5, is_featured: false, is_active: true, is_approved: true, eleventa_sku: "DEMO-006", category_id: "demo-bloques", subcategory_id: null, weight: null, created_at: now, updated_at: now, categories: cat("demo-bloques") },
];

export function demoCategoryBySlug(slug: string): Category | null {
  return demoCategories.find((c) => c.slug === slug) ?? null;
}

export function demoProductsForCategory(categoryId: string): Product[] {
  return demoProducts.filter((p) => p.category_id === categoryId);
}

export const demoFeaturedProducts = demoProducts.filter((p) => p.is_featured).slice(0, 8);
export const demoRecentProducts = demoProducts.slice(0, 8);
