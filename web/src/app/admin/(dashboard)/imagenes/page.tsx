import { createClient } from "@/lib/supabase/server";
import { Package, CheckCircle, Clock, AlertCircle } from "lucide-react";
import ImageJobActions from "./ImageJobActions";

interface SearchParams {
  estado?: string;
  pagina?: string;
  [key: string]: string | undefined;
}

const PAGE_SIZE = 30;

async function getStats() {
  const supabase = await createClient();
  const [
    { count: sinImagen },
    { count: jobsPending },
    { count: jobsDone },
    { count: jobsError },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true).is("image_url", null),
    supabase.from("image_jobs").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("image_jobs").select("*", { count: "exact", head: true }).eq("status", "done"),
    supabase.from("image_jobs").select("*", { count: "exact", head: true }).eq("status", "error"),
  ]);
  return { sinImagen, jobsPending, jobsDone, jobsError };
}

async function getProductsWithoutImages(params: SearchParams) {
  const supabase = await createClient();
  const page = Number(params.pagina ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("products")
    .select("id, name, eleventa_sku, price, categories(name, emoji)", { count: "exact" })
    .eq("is_active", true)
    .is("image_url", null)
    .order("name")
    .range(from, to);

  return { products: data ?? [], total: count ?? 0 };
}

async function getImageJobs(params: SearchParams) {
  const supabase = await createClient();
  const page = Number(params.pagina ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("image_jobs")
    .select("id, product_id, source_url, status, priority, error_msg, created_at, processed_at, products(name, image_url)", { count: "exact" });

  if (params.estado) query = query.eq("status", params.estado);
  else query = query.neq("status", "done");

  query = query.order("priority", { ascending: false }).order("created_at").range(from, to);
  const { data, count } = await query;
  return { jobs: data ?? [], total: count ?? 0 };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: "Pendiente",   color: "bg-yellow-100 text-yellow-800", icon: Clock },
  processing: { label: "Procesando",  color: "bg-blue-100 text-blue-800",    icon: Clock },
  done:       { label: "Listo",       color: "bg-green-100 text-green-800",  icon: CheckCircle },
  error:      { label: "Error",       color: "bg-red-100 text-red-800",      icon: AlertCircle },
};

export default async function ImagenesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [stats, { products, total: totalSinImg }, { jobs, total: totalJobs }] = await Promise.all([
    getStats(),
    getProductsWithoutImages(params),
    getImageJobs(params),
  ]);

  const VIEW = params.estado === "cola" ? "cola" : "sin-imagen";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Gestión de imágenes</h1>
        <p className="text-muted-foreground text-sm mt-1">Asigna y procesa imágenes de productos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Sin imagen", value: stats.sinImagen ?? 0, color: "bg-orange-50 text-orange-700", icon: Package },
          { label: "En cola", value: stats.jobsPending ?? 0, color: "bg-yellow-50 text-yellow-700", icon: Clock },
          { label: "Procesados", value: stats.jobsDone ?? 0, color: "bg-green-50 text-green-700", icon: CheckCircle },
          { label: "Con error", value: stats.jobsError ?? 0, color: "bg-red-50 text-red-700", icon: AlertCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-bold text-2xl">{value.toLocaleString("es-MX")}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <a href="?estado=" className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${VIEW === "sin-imagen" ? "bg-[#1E40AF] text-white" : "bg-white border border-border hover:bg-surface"}`}>
          Sin imagen ({stats.sinImagen ?? 0})
        </a>
        <a href="?estado=cola" className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${VIEW === "cola" ? "bg-[#1E40AF] text-white" : "bg-white border border-border hover:bg-surface"}`}>
          Cola de procesamiento ({totalJobs})
        </a>
      </div>

      {/* Products without images */}
      {VIEW === "sin-imagen" && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="font-display font-semibold">{totalSinImg.toLocaleString("es-MX")} productos sin imagen</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {["SKU", "Nombre", "Categoría", "Precio", "Asignar imagen"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">¡Todos los productos tienen imagen!</td></tr>
                )}
                {products.map((p) => {
                  const cat = (Array.isArray(p.categories) ? p.categories[0] : p.categories) as { name: string; emoji: string } | null;
                  return (
                    <tr key={p.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.eleventa_sku ?? "—"}</td>
                      <td className="px-4 py-3 max-w-xs"><p className="font-medium line-clamp-1">{p.name}</p></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{cat ? `${cat.emoji} ${cat.name}` : "—"}</td>
                      <td className="px-4 py-3 font-semibold">${p.price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3">
                        <ImageJobActions productId={p.id} productName={p.name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {Math.ceil(totalSinImg / PAGE_SIZE) > 1 && (
            <div className="flex justify-center gap-2 px-4 py-4 border-t border-border">
              {Array.from({ length: Math.ceil(totalSinImg / PAGE_SIZE) }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === Math.ceil(totalSinImg / PAGE_SIZE) || Math.abs(p - Number(params.pagina ?? 1)) <= 2)
                .map((p) => (
                  <a key={p} href={`?estado=&pagina=${p}`}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === Number(params.pagina ?? 1) ? "bg-[#1E40AF] text-white" : "bg-surface hover:bg-border"}`}
                  >{p}</a>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Image jobs queue */}
      {VIEW === "cola" && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="font-display font-semibold">Cola de procesamiento</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {["Producto", "URL origen", "Estado", "Prioridad", "Creado"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Cola vacía.</td></tr>
                )}
                {jobs.map((job) => {
                  const prod = (Array.isArray(job.products) ? job.products[0] : job.products) as { name: string; image_url: string | null } | null;
                  const sc = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
                  const Icon = sc.icon;
                  return (
                    <tr key={job.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          {prod?.image_url
                            ? <img src={prod.image_url} alt="" className="w-8 h-8 rounded object-contain border border-border" />
                            : <div className="w-8 h-8 rounded bg-surface flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                          }
                          <p className="font-medium line-clamp-1">{prod?.name ?? job.product_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-muted-foreground truncate max-w-48">{job.source_url ?? "—"}</p>
                        {job.error_msg && <p className="text-xs text-destructive mt-0.5 truncate max-w-48">{job.error_msg}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          <Icon className="w-3 h-3" /> {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-sm">{job.priority}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(job.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
