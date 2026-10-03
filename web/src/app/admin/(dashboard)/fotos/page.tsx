import Link from "next/link";
import { requirePageRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunk } from "@/lib/catalog-status";
import { SUGGESTION_LEVELS, isSuggestionLevel, pairSuggestions, type ProductForSuggestion, type SuggestionLevel } from "@/lib/photo-suggestions";
import SuggestionCard from "./SuggestionCard";

const PAGE_SIZE = 20;

export default async function AdminFotosPage({ searchParams }: { searchParams: Promise<{ nivel?: string }> }) {
  await requirePageRole("admin");
  const params = await searchParams;
  const nivel: SuggestionLevel = isSuggestionLevel(params.nivel) ? params.nivel : "muy_alta";
  const db = createAdminClient();

  const counts = await Promise.all(
    SUGGESTION_LEVELS.map(async ({ key }) => {
      const { count } = await db.from("photo_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending").eq("nivel", key);
      return [key, count ?? 0] as const;
    })
  );

  // Se leen de más porque algunas ya no aplican (el producto ya tiene foto).
  const { data: suggestions, error } = await db
    .from("photo_suggestions")
    .select("id, clave, source_url, page_url, fuente, nivel, motivo, lote")
    .eq("status", "pending")
    .eq("nivel", nivel)
    .order("lote")
    .order("created_at")
    .limit(PAGE_SIZE * 3);
  if (error) throw error;

  const claves = Array.from(new Set((suggestions ?? []).map((s) => s.clave)));
  const products: Array<ProductForSuggestion & { name: string; price: number; stock: number }> = [];
  for (const part of chunk(claves, 200)) {
    const { data, error: productsErr } = await db
      .from("products")
      .select("id, name, price, stock, eleventa_sku, image_url, is_active")
      .in("eleventa_sku", part);
    if (productsErr) throw productsErr;
    products.push(...(data ?? []));
  }
  const pairs = pairSuggestions(suggestions ?? [], products).slice(0, PAGE_SIZE);
  const levelMeta = SUGGESTION_LEVELS.find((l) => l.key === nivel)!;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl">Fotos sugeridas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fotos encontradas para productos que no tienen. Revisa que sea el mismo producto: <b>Aceptar</b> la guarda en el producto,{" "}
          <b>Descartar</b> la quita de esta lista. Publicar sigue siendo aparte, en Productos.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTION_LEVELS.map(({ key, label, hint }) => {
          const count = counts.find(([k]) => k === key)?.[1] ?? 0;
          return (
            <Link
              key={key}
              href={`?nivel=${key}`}
              title={hint}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                nivel === key ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-border"
              }`}
            >
              {label} ({count.toLocaleString("es-MX")})
            </Link>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">{levelMeta.hint}</p>

      {pairs.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground text-sm bg-white rounded-2xl border border-border">
          No hay sugerencias pendientes en este nivel.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {pairs.map(({ suggestion, product }) => (
            <SuggestionCard
              key={suggestion.id}
              suggestionId={suggestion.id}
              productName={product.name}
              sku={product.eleventa_sku ?? ""}
              price={Number(product.price)}
              stock={product.stock}
              fuente={suggestion.fuente}
              motivo={suggestion.motivo}
              pageUrl={suggestion.page_url ?? suggestion.source_url}
              editHref={`/admin/productos/${product.id}/editar`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
