// Estados del catálogo en el panel. Un producto de Eleventa pasa por:
//   sin foto / sin categoría → listo para publicar → publicado
// y administración puede bloquearlo en cualquier momento.

export type ProductFilter = "todos" | "sin_foto" | "sin_categoria" | "listos" | "publicados" | "bloqueados" | "agotados" | "inactivos";

export const PRODUCT_FILTERS: Array<{ key: ProductFilter; label: string; hint: string }> = [
  { key: "sin_foto", label: "Sin foto", hint: "Falta subir o importar la foto" },
  { key: "sin_categoria", label: "Sin categoría", hint: "Tienen foto pero falta elegir categoría" },
  { key: "listos", label: "Listos para publicar", hint: "Tienen todo; solo falta publicarlos" },
  { key: "publicados", label: "Publicados", hint: "Se venden en línea (si hay stock)" },
  { key: "agotados", label: "Agotados", hint: "Stock en 0: no se muestran en la tienda" },
  { key: "bloqueados", label: "Bloqueados", hint: "Administración los retiró de la venta en línea" },
  { key: "inactivos", label: "Ya no en Eleventa", hint: "Dejaron de existir en el punto de venta" },
  { key: "todos", label: "Todos", hint: "Catálogo completo" },
];

export function isProductFilter(v: string | undefined): v is ProductFilter {
  return PRODUCT_FILTERS.some((f) => f.key === v);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Aplica el filtro a una consulta de `products` (PostgREST). Tipado laxo a
 * propósito: los tipos del query builder de Supabase son demasiado profundos
 * para restringirlos con genéricos.
 */
export function applyProductFilter<Q>(query: Q, filter: ProductFilter): Q {
  const q = query as any;
  const workable = () => q.eq("is_approved", false).eq("is_blocked", false).eq("is_active", true);
  switch (filter) {
    case "sin_foto":
      return workable().is("image_url", null);
    case "sin_categoria":
      return workable().not("image_url", "is", null).is("category_id", null);
    case "listos":
      return workable().not("image_url", "is", null).not("category_id", "is", null).gt("price", 0);
    case "publicados":
      return q.eq("is_approved", true);
    case "bloqueados":
      return q.eq("is_blocked", true);
    case "agotados":
      return q.eq("is_active", true).lte("stock", 0);
    case "inactivos":
      return q.eq("is_active", false);
    default:
      return query;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Limpia texto de búsqueda para usarlo dentro de un filtro or() de PostgREST. */
export function searchTerm(raw: string | undefined): string {
  return (raw ?? "").replace(/[,()*%\\"]/g, " ").trim().slice(0, 80);
}

export interface PanelProductState {
  is_active: boolean;
  is_approved: boolean;
  is_blocked: boolean;
  image_url: string | null;
  category_id: string | null;
  price: number;
}

export function productStage(p: PanelProductState): { label: string; tone: "ok" | "warn" | "muted" | "danger" | "info" } {
  if (p.is_blocked) return { label: "Bloqueado", tone: "danger" };
  if (!p.is_active) return { label: "Ya no en Eleventa", tone: "muted" };
  if (p.is_approved) return { label: "Publicado", tone: "ok" };
  if (!p.image_url) return { label: "Sin foto", tone: "warn" };
  if (!p.category_id) return { label: "Sin categoría", tone: "warn" };
  if (!(Number(p.price) > 0)) return { label: "Sin precio", tone: "warn" };
  return { label: "Listo para publicar", tone: "info" };
}

export const TONE_CLASS: Record<"ok" | "warn" | "muted" | "danger" | "info", string> = {
  ok: "bg-green-100 text-green-800",
  warn: "bg-amber-100 text-amber-800",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-accent/10 text-primary",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  requires_attention: "Requiere atención",
};
