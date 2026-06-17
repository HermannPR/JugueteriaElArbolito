import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CheckCircle, XCircle, Edit, Eye, EyeOff } from "lucide-react";
import ApproveButton from "./ApproveButton";

interface SearchParams {
  estado?: string;
  categoria?: string;
  q?: string;
  pagina?: string;
  [key: string]: string | undefined;
}

const PAGE_SIZE = 30;

async function getProducts(params: SearchParams) {
  const supabase = await createClient();
  const page = Number(params.pagina ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select("id, name, price, stock, is_approved, is_active, is_featured, image_url, eleventa_sku, categories(name, emoji)", { count: "exact" });

  if (params.estado === "pendiente") query = query.eq("is_approved", false).eq("is_active", true);
  else if (params.estado === "aprobado") query = query.eq("is_approved", true).eq("is_active", true);
  else if (params.estado === "inactivo") query = query.eq("is_active", false);

  if (params.q) query = query.ilike("name", `%${params.q}%`);

  query = query.order("is_approved").order("name").range(from, to);

  const { data, count } = await query;
  return { products: data ?? [], total: count ?? 0 };
}

export default async function AdminProductosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { products, total } = await getProducts(params);
  const page = Number(params.pagina ?? 1);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const ESTADOS = [
    { key: "", label: "Todos" },
    { key: "pendiente", label: "Pendientes" },
    { key: "aprobado", label: "Aprobados" },
    { key: "inactivo", label: "Inactivos" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl">Productos</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString("es-MX")} producto{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {ESTADOS.map(({ key, label }) => (
            <a
              key={key}
              href={`?${new URLSearchParams({ ...params, estado: key, pagina: "1" })}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (params.estado ?? "") === key
                  ? "bg-[#1E40AF] text-white"
                  : "bg-surface text-foreground hover:bg-border"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
        <form className="flex-1 min-w-48" method="GET">
          {params.estado && <input type="hidden" name="estado" value={params.estado} />}
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Buscar producto..."
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          />
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                {["SKU", "Nombre", "Categoría", "Precio", "Stock", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">Sin productos con estos filtros.</td>
                </tr>
              )}
              {products.map((p) => {
                const cat = (Array.isArray(p.categories) ? p.categories[0] : p.categories) as { name: string; emoji: string } | null;
                return (
                  <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.eleventa_sku ?? "—"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium line-clamp-1">{p.name}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {cat ? `${cat.emoji} ${cat.name}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      ${p.price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${p.stock === 0 ? "text-destructive" : p.stock <= 3 ? "text-amber-600" : "text-green-600"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!p.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <EyeOff className="w-3 h-3" /> Inactivo
                        </span>
                      ) : p.is_approved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <CheckCircle className="w-3 h-3" /> Aprobado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <XCircle className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!p.is_approved && p.is_active && (
                          <ApproveButton productId={p.id} />
                        )}
                        <Link
                          href={`/admin/productos/${p.id}/editar`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
                        >
                          <Edit className="w-3 h-3" /> Editar
                        </Link>
                        <Link
                          href={`/producto/${p.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 px-4 py-4 border-t border-border">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => (
                <>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span key={`e-${p}`} className="text-muted-foreground px-1">…</span>
                  )}
                  <a
                    key={p}
                    href={`?${new URLSearchParams({ ...params, pagina: String(p) })}`}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      p === page ? "bg-[#1E40AF] text-white" : "bg-surface hover:bg-border"
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
  );
}
