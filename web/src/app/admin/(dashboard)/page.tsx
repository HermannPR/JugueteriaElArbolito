import Link from "next/link";
import { AlertTriangle, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageRole } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { PRODUCT_FILTERS, applyProductFilter, ORDER_STATUS_LABEL, type ProductFilter } from "@/lib/catalog-status";

const PROGRESS_FILTERS: ProductFilter[] = ["sin_foto", "sin_categoria", "listos", "publicados", "agotados", "bloqueados"];

async function countProducts(filter: ProductFilter | "activos") {
  const supabase = await createClient();
  const base = supabase.from("products").select("id", { count: "exact", head: true });
  const { count } = filter === "activos" ? await base.eq("is_active", true) : await applyProductFilter(base, filter);
  return count ?? 0;
}

async function getOrders() {
  const supabase = await createClient();
  const [attention, recent] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).in("order_status", ["requires_attention", "processing"]),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, total, order_status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return { toHandle: attention.count ?? 0, recent: recent.data ?? [] };
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requirePageRole("staff");
  const { error } = await searchParams;
  const isAdmin = hasRole(user.role, "admin");

  const [active, ...counts] = await Promise.all([countProducts("activos"), ...PROGRESS_FILTERS.map(countProducts)]);
  const byFilter = Object.fromEntries(PROGRESS_FILTERS.map((f, i) => [f, counts[i]])) as Record<ProductFilter, number>;
  const published = byFilter.publicados;
  const pct = active ? Math.round((published / active) * 100) : 0;
  const orders = isAdmin ? await getOrders() : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {error === "sin_permiso" && (
        <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-xl border border-amber-200">
          Tu cuenta no tiene acceso a esa sección.
        </div>
      )}

      <div>
        <h1 className="font-display font-bold text-2xl">Inicio</h1>
        <p className="text-muted-foreground text-sm mt-1">Avance del catálogo en línea</p>
      </div>

      <section className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">Publicados en la tienda en línea</p>
            <p className="font-display font-bold text-3xl">
              {published.toLocaleString("es-MX")}
              <span className="text-muted-foreground text-lg font-medium"> / {active.toLocaleString("es-MX")}</span>
            </p>
          </div>
          <p className="font-display font-bold text-2xl text-primary">{pct}%</p>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {PROGRESS_FILTERS.map((key) => {
            const meta = PRODUCT_FILTERS.find((f) => f.key === key)!;
            return (
              <Link
                key={key}
                href={`/admin/productos?estado=${key}`}
                className="rounded-xl border border-border p-3 hover:border-accent hover:bg-surface transition-colors"
                title={meta.hint}
              >
                <p className="font-display font-bold text-xl">{byFilter[key].toLocaleString("es-MX")}</p>
                <p className="text-xs text-muted-foreground">{meta.label}</p>
              </Link>
            );
          })}
        </div>
        {byFilter.sin_foto + byFilter.sin_categoria > 0 && (
          <Link href="/admin/productos?estado=sin_foto" className="inline-flex text-sm font-medium text-primary hover:underline">
            Continuar con los productos sin foto →
          </Link>
        )}
      </section>

      {orders && (
        <section className="grid lg:grid-cols-3 gap-4">
          <Link
            href="/admin/pedidos"
            className="bg-white rounded-2xl border border-border shadow-sm p-6 flex items-start gap-3 hover:border-accent transition-colors"
          >
            {orders.toHandle > 0 ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" /> : <ShoppingBag className="w-5 h-5 text-muted-foreground shrink-0" />}
            <div>
              <p className="font-display font-bold text-2xl">{orders.toHandle}</p>
              <p className="text-sm text-muted-foreground">Pedidos por preparar o que requieren atención</p>
            </div>
          </Link>
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="font-display font-semibold">Pedidos recientes</h2>
              <Link href="/admin/pedidos" className="text-sm text-primary hover:underline">Ver todos</Link>
            </div>
            {orders.recent.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground text-center">Aún no hay pedidos.</p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.recent.map((o) => (
                  <li key={o.id} className="px-6 py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{o.order_number}</p>
                      <p className="text-muted-foreground truncate">{o.customer_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{ORDER_STATUS_LABEL[o.order_status] ?? o.order_status}</span>
                    <span className="font-semibold whitespace-nowrap">${Number(o.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
