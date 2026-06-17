import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/catalog/ProductCard";
import CatalogFilters from "@/components/catalog/CatalogFilters";
import SortSelect from "@/components/catalog/SortSelect";
import type { Category, Product } from "@/types";

interface SearchParams {
  q?: string;
  categoria?: string;
  orden?: string;
  destacados?: string;
  precio_min?: string;
  precio_max?: string;
  pagina?: string;
  [key: string]: string | undefined;
}

const PAGE_SIZE = 24;

async function getProducts(params: SearchParams): Promise<{ products: Product[]; total: number }> {
  const supabase = await createClient();
  const page = Number(params.pagina ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select("*, categories(name,slug,emoji,color)", { count: "exact" })
    .eq("is_active", true)
    .eq("is_approved", true)
    .gt("stock", 0);

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.categoria) query = query.eq("categories.slug", params.categoria);
  if (params.destacados) query = query.eq("is_featured", true);
  if (params.precio_min) query = query.gte("price", Number(params.precio_min));
  if (params.precio_max) query = query.lte("price", Number(params.precio_max));

  if (params.orden === "precio_asc") query = query.order("price", { ascending: true });
  else if (params.orden === "precio_desc") query = query.order("price", { ascending: false });
  else if (params.orden === "nuevos") query = query.order("created_at", { ascending: false });
  else query = query.order("name");

  query = query.range(from, to);

  const { data, count } = await query;
  return { products: (data as Product[]) ?? [], total: count ?? 0 };
}

async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  return data ?? [];
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ products, total }, categories] = await Promise.all([
    getProducts(params),
    getCategories(),
  ]);

  const page = Number(params.pagina ?? 1);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const title = params.q
    ? `Resultados para "${params.q}"`
    : params.destacados
    ? "Productos destacados"
    : "Catálogo completo";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filtros */}
        <aside className="lg:w-64 shrink-0">
          <CatalogFilters categories={categories} currentParams={params} />
        </aside>

        {/* Productos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display font-bold text-2xl">{title}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {total.toLocaleString("es-MX")} producto{total !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Ordenar */}
            <SortSelect currentOrden={params.orden} />
          </div>

          {products.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-display font-semibold text-lg">Sin resultados</p>
              <p className="text-sm mt-1">Intenta con otros filtros o términos de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span key={`ellipsis-${p}`} className="text-muted-foreground px-1">…</span>
                    )}
                    <a
                      key={p}
                      href={`?${new URLSearchParams({ ...params, pagina: String(p) })}`}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        p === page
                          ? "bg-primary text-white"
                          : "bg-surface hover:bg-border text-foreground"
                      }`}
                    >
                      {p}
                    </a>
                  </>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Package({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}
