// Fotos sugeridas (tabla photo_suggestions). Sin imports a propósito, para
// probarlo con node --test.

export type SuggestionLevel = "muy_alta" | "alta" | "media";

export const SUGGESTION_LEVELS: Array<{ key: SuggestionLevel; label: string; hint: string }> = [
  { key: "muy_alta", label: "Certeza muy alta", hint: "Ficha del fabricante, mismo producto" },
  { key: "alta", label: "Certeza alta", hint: "Mismo producto; revisa color o edición" },
  { key: "media", label: "Certeza media", hint: "La marca tiene modelos parecidos: compara con el producto" },
];

export function isSuggestionLevel(v: string | undefined): v is SuggestionLevel {
  return SUGGESTION_LEVELS.some((l) => l.key === v);
}

export interface SuggestionRow {
  id: string;
  clave: string;
}

export interface ProductForSuggestion {
  id: string;
  eleventa_sku: string | null;
  image_url: string | null;
  is_active: boolean;
}

/**
 * Junta cada sugerencia con su producto. Solo quedan las que todavía sirven:
 * el producto existe, sigue en Eleventa y no tiene foto.
 */
export function pairSuggestions<S extends SuggestionRow, P extends ProductForSuggestion>(
  suggestions: S[],
  products: P[]
): Array<{ suggestion: S; product: P }> {
  const bySku = new Map(products.filter((p) => p.eleventa_sku).map((p) => [p.eleventa_sku as string, p]));
  const out: Array<{ suggestion: S; product: P }> = [];
  for (const suggestion of suggestions) {
    const product = bySku.get(suggestion.clave);
    if (product && product.is_active && !product.image_url) out.push({ suggestion, product });
  }
  return out;
}
