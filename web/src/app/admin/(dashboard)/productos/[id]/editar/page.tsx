import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePageRole } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { TONE_CLASS, applyProductFilter, productStage, type ProductFilter } from "@/lib/catalog-status";
import { AdminControls, DetailsForm, ImagePanel, PublishPanel } from "./ProductPanels";

const STAGE_FILTER: Record<string, ProductFilter> = {
  "Sin foto": "sin_foto",
  "Sin categoría": "sin_categoria",
  "Listo para publicar": "listos",
};

const ACTION_LABEL: Record<string, string> = {
  "product.details": "Editó datos",
  "product.image_upload": "Subió foto",
  "product.image_url": "Importó foto desde URL",
  "product.image_remove": "Quitó la foto",
  "product.publish": "Publicó",
  "product.unpublish": "Despublicó",
  "product.pricing": "Cambió precio/destacado",
  "product.block": "Bloqueó",
  "product.unblock": "Desbloqueó",
  "product.stock_adjust": "Ajustó stock",
  "product.stock_buffer": "Cambió reserva",
};

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  const user = await requirePageRole("staff");
  const isAdmin = hasRole(user.role, "admin");
  const { id } = await params;
  const { volver } = await searchParams;
  const backHref = volver?.startsWith("?") ? `/admin/productos${volver}` : "/admin/productos";

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, price, old_price, stock, stock_buffer, image_url, category_id, subcategory_id, is_active, is_approved, is_blocked, blocked_reason, is_featured, price_overridden, eleventa_sku, last_synced_at")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase.from("categories").select("id, name, emoji").order("display_order"),
    supabase.from("subcategories").select("id, name, category_id").order("display_order"),
  ]);

  const stage = productStage(product);

  // Siguiente producto con el mismo pendiente, para trabajar en fila.
  let nextId: string | null = null;
  const nextFilter = STAGE_FILTER[stage.label];
  if (nextFilter) {
    const { data } = await applyProductFilter(supabase.from("products").select("id"), nextFilter)
      .gt("name", product.name)
      .order("name")
      .limit(1);
    nextId = data?.[0]?.id ?? null;
  }

  const history = isAdmin
    ? (
        await supabase
          .from("audit_log")
          .select("id, action, actor_email, details, created_at")
          .eq("entity", "product")
          .eq("entity_id", id)
          .order("created_at", { ascending: false })
          .limit(15)
      ).data ?? []
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver a la lista
        </Link>
        {nextId && (
          <Link
            href={`/admin/productos/${nextId}/editar${volver ? `?volver=${encodeURIComponent(volver)}` : ""}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Siguiente producto {stage.label.toLowerCase()} →
          </Link>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display font-bold text-xl">{product.name}</h1>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${TONE_CLASS[stage.tone]}`}>{stage.label}</span>
        </div>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Código Eleventa: {product.eleventa_sku ?? "—"} · ${Number(product.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })} · {product.stock} en stock
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <ImagePanel productId={product.id} imageUrl={product.image_url} />
          <PublishPanel product={product} />
        </div>
        <div className="lg:col-span-3 space-y-5">
          <DetailsForm product={product} categories={categories ?? []} subcategories={subcategories ?? []} />
          {isAdmin && <AdminControls product={product} />}
          {isAdmin && (
            <section className="bg-white rounded-2xl border border-border shadow-sm p-5">
              <h2 className="font-display font-semibold mb-3">Historial</h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between gap-3">
                      <span>
                        <span className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</span>
                        {h.action === "product.stock_adjust" && h.details && (
                          <span className="text-muted-foreground"> ({(h.details as { delta: number }).delta > 0 ? "+" : ""}{(h.details as { delta: number }).delta}: {(h.details as { note: string }).note})</span>
                        )}
                        {h.action === "product.block" && h.details && (
                          <span className="text-muted-foreground"> ({(h.details as { reason: string }).reason})</span>
                        )}
                        <span className="text-muted-foreground"> · {h.actor_email}</span>
                      </span>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(h.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
