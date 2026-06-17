"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Link as LinkIcon, X } from "lucide-react";
import type { Category } from "@/types";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  old_price: number | null;
  stock: number;
  stock_buffer: number | null;
  image_url: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_featured: boolean;
  price_overridden: boolean;
  category_id: string | null;
  eleventa_sku: string | null;
}

interface Props {
  product: Product;
  categories: Category[];
}

export default function ProductEditForm({ product, categories }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setImgUploading(true);
    setImgError("");
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `products/${product.id}.${ext}`;
    const { error: err } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (err) { setImgError(err.message); setImgUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    await supabase.from("products").update({ image_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", product.id);
    set("image_url", publicUrl);
    setImgUploading(false);
    router.refresh();
  }

  async function importFromUrl() {
    if (!urlInput.trim()) return;
    setImgUploading(true);
    setImgError("");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ product_id: product.id, source_url: urlInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setImgError(data.error ?? "Error al importar imagen"); }
    else { set("image_url", data.image_url); router.refresh(); }
    setUrlInput("");
    setImgUploading(false);
  }

  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    old_price: String(product.old_price ?? ""),
    stock_buffer: String(product.stock_buffer ?? 0),
    image_url: product.image_url ?? "",
    category_id: product.category_id ?? "",
    is_active: product.is_active,
    is_featured: product.is_featured,
    price_overridden: product.price_overridden,
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const updates: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      stock_buffer: Number(form.stock_buffer) || 0,
      image_url: form.image_url.trim() || null,
      category_id: form.category_id || null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      price_overridden: form.price_overridden,
      updated_at: new Date().toISOString(),
    };

    // Only update price if price_overridden
    if (form.price_overridden) {
      updates.price = Number(form.price);
      updates.old_price = form.old_price ? Number(form.old_price) : null;
    }

    const { error: err } = await supabase.from("products").update(updates).eq("id", product.id);

    if (err) {
      setError("Error al guardar: " + err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
      {error && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg">{error}</div>}

      <div className="space-y-1">
        <label className="text-sm font-medium">Nombre</label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
          placeholder="Descripción del producto..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Categoría</label>
        <select
          value={form.category_id}
          onChange={(e) => set("category_id", e.target.value)}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] bg-white"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Precio (MXN)
            <span className="text-muted-foreground font-normal text-xs ml-1">
              {!form.price_overridden && "— sincronizado de Eleventa"}
            </span>
          </label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            disabled={!form.price_overridden}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Precio anterior</label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.old_price}
            onChange={(e) => set("old_price", e.target.value)}
            disabled={!form.price_overridden}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="price_overridden"
          type="checkbox"
          checked={form.price_overridden}
          onChange={(e) => set("price_overridden", e.target.checked)}
          className="w-4 h-4 accent-[#1E40AF]"
        />
        <label htmlFor="price_overridden" className="text-sm">
          Fijar precio manualmente (no sincronizar con Eleventa)
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Buffer de stock</label>
        <Input
          type="number"
          min={0}
          value={form.stock_buffer}
          onChange={(e) => set("stock_buffer", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Unidades reservadas para prevenir sobreventa.</p>
      </div>

      {/* Imagen */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Imagen</label>
        {form.image_url && (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.image_url} alt="preview" className="w-full h-full object-contain p-1" />
            <button
              type="button"
              onClick={() => set("image_url", "")}
              className="absolute top-1 right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center hover:opacity-90"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {imgError && <p className="text-xs text-destructive">{imgError}</p>}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          />
          <Button type="button" variant="outline" size="sm" disabled={imgUploading}
            onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            {imgUploading ? "Subiendo..." : "Subir archivo"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://... (importar desde URL)"
            type="url"
            className="text-sm h-8"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); importFromUrl(); } }}
          />
          <Button type="button" variant="outline" size="sm" disabled={imgUploading || !urlInput.trim()}
            onClick={importFromUrl} className="gap-1.5 shrink-0">
            <LinkIcon className="w-3.5 h-3.5" /> Importar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          { field: "is_active", label: "Producto activo" },
          { field: "is_featured", label: "Destacado" },
        ].map(({ field, label }) => (
          <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form[field as keyof typeof form] as boolean}
              onChange={(e) => set(field, e.target.checked)}
              className="w-4 h-4 accent-[#1E40AF]"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="bg-[#1E40AF] hover:bg-[#1e3a8a]">
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
