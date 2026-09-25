import Link from "next/link";
import { ImageOff, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageRole } from "@/lib/auth";
import {
  PRODUCT_FILTERS,
  TONE_CLASS,
  applyProductFilter,
  isProductFilter,
  productStage,
  searchTerm,
  type ProductFilter,
} from "@/lib/catalog-status";
import PublishButton from "./PublishButton";

interface SearchParams {
  estado?: string;
  categoria?: string;
  q?: string;
  pagina?: string;
}

const PAGE_SIZE = 30;

export default async function AdminProductosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePageRole("staff");
  const params = await searchParams;
  const filter: ProductFilter = isProductFilter(params.estado) ? params.estado : "sin_foto";
  const q = searchTerm(params.q);
  const page = Math.max(1, Number(params.pagina) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, price, stock, image_url, eleventa_sku, category_id, is_active, is_approved, is_blocked, categories(name, emoji)", { count: "exact" });
  // Con búsqueda se ignora el filtro de estado: el empleado busca un producto concreto.
  query = q ? query.or(`name.ilike.%${q}%,eleventa_sku.ilike.%${q}%`) : applyProductFilter(query, filter);
  if (params.categoria) query = query.eq("category_id", params.categoria);
  const { data: products, count } = await query.order("name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: categories } = await supabase.from("categories").select("id, name, emoji").order("display_order");

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const link = (patch: Partial<SearchParams>) => {
    const next = { ...params, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    return `?${qs}`;
  };
  const filterMeta = PRODUCT_FILTERS.find((f) => f.key === filter)!;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl">Productos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {q ? `Resultados para "${q}"` : filterMeta.hint} · {total.toLocaleString("es-MX")} producto{total !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm space-y-3">
        <form method="GET" className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Buscar por nombre o código (puedes escanear el código de barras)"
              className="w-full text-sm border border-border rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus={Boolean(params.q)}
            />
          </div>
          {params.categoria && <input type="hidden" name="categoria" value={params.categoria} />}
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Buscar</button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_FILTERS.map(({ key, label, hint }) => (
            <Link
              key={key}
              href={link({ estado: key, q: undefined, pagina: undefined })}
              title={hint}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !q && filter === key ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-border"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <Link
            href={link({ categoria: undefined, pagina: undefined })}
            className={`px-2.5 py-1 rounded-full border ${!params.categoria ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            Todas las categorías
          </Link>
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              href={link({ categoria: c.id, pagina: undefined })}
              className={`px-2.5 py-1 rounded-full border ${params.categoria === c.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
            >
              {c.emoji} {c.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {(products ?? []).length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">
            {q ? "No hay productos con ese nombre o código." : "No hay productos en este estado. ¡Buen trabajo!"}
          </p>
        )}
        <ul className="divide-y divide-border">
          {(products ?? []).map((p) => {
            const cat = (Array.isArray(p.categories) ? p.categories[0] : p.categories) as { name: string; emoji: string } | null;
            const stage = productStage(p);
            const editHref = `/admin/productos/${p.id}/editar?volver=${encodeURIComponent(link({}))}`;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface/60 transition-colors">
                <Link href={editHref} className="shrink-0 w-14 h-14 rounded-lg border border-border bg-surface overflow-hidden flex items-center justify-center">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <ImageOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </Link>
                <Link href={editHref} className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{p.eleventa_sku ?? "sin código"}</p>
                  <p className="text-xs text-muted-foreground sm:hidden">
                    ${Number(p.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })} · {p.stock} en stock
                  </p>
                </Link>
                <span className="hidden md:block text-xs text-muted-foreground w-40 truncate">{cat ? `${cat.emoji} ${cat.name}` : "—"}</span>
                <span className="hidden sm:block text-sm font-semibold w-24 text-right">
                  ${Number(p.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
                <span className={`hidden sm:block text-sm w-14 text-right ${p.stock <= 0 ? "text-destructive" : ""}`}>{p.stock}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${TONE_CLASS[stage.tone]}`}>{stage.label}</span>
                {stage.label === "Listo para publicar" && <PublishButton productId={p.id} />}
              </li>
            );
          })}
        </ul>

        {totalPages > 1 && (
          <nav className="flex justify-center items-center gap-3 px-4 py-4 border-t border-border text-sm">
            {page > 1 ? <Link href={link({ pagina: String(page - 1) })} className="text-primary hover:underline">← Anterior</Link> : <span />}
            <span className="text-muted-foreground">Página {page} de {totalPages}</span>
            {page < totalPages ? <Link href={link({ pagina: String(page + 1) })} className="text-primary hover:underline">Siguiente →</Link> : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}
