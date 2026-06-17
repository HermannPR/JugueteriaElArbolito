export interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  display_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  old_price: number | null;
  image_url: string | null;
  image_urls: string[] | null;
  stock: number;
  stock_buffer: number;
  is_featured: boolean;
  is_active: boolean;
  is_approved: boolean;
  eleventa_sku: string;
  category_id: string | null;
  subcategory_id: string | null;
  weight: number | null;
  created_at: string;
  updated_at: string;
  // joined
  categories?: Pick<Category, "name" | "slug" | "emoji" | "color">;
  subcategories?: Pick<Subcategory, "name" | "slug">;
}

export interface CartItem {
  product: Pick<Product, "id" | "name" | "price" | "image_url" | "stock" | "stock_buffer" | "eleventa_sku">;
  quantity: number;
}
