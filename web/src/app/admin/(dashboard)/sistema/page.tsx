import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { requirePageRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Level = "ok" | "warn" | "error";

function Status({ level, children }: { level: Level; children: React.ReactNode }) {
  const Icon = level === "ok" ? CheckCircle2 : level === "warn" ? AlertTriangle : XCircle;
  const color = level === "ok" ? "text-green-600" : level === "warn" ? "text-amber-600" : "text-destructive";
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
      <span>{children}</span>
    </li>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace menos de 1 min";
  if (min < 60) return `hace ${min} min`;
  if (min < 48 * 60) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
}

/** Solo informa si cada secreto existe; jamás muestra su valor. */
function configChecks(): Array<{ level: Level; text: string }> {
  const env = process.env;
  const mp = env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  const site = env.NEXT_PUBLIC_SITE_URL ?? "";
  return [
    { level: env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "error", text: "Llave de servidor de Supabase (SUPABASE_SERVICE_ROLE_KEY)" },
    {
      level: !mp ? "error" : mp.startsWith("TEST-") ? "warn" : "ok",
      text: !mp ? "Mercado Pago sin configurar: no se puede cobrar" : mp.startsWith("TEST-") ? "Mercado Pago en modo PRUEBA (no cobra dinero real)" : "Mercado Pago en producción",
    },
    { level: env.MERCADOPAGO_WEBHOOK_SECRET ? "ok" : "error", text: "Clave del webhook de Mercado Pago (sin ella los pagos no se confirman)" },
    { level: env.CRON_SECRET ? "ok" : "warn", text: "CRON_SECRET (mantiene activa la base del plan gratuito)" },
    { level: site.startsWith("https://") ? "ok" : "warn", text: `URL pública del sitio: ${site || "sin definir"}` },
    { level: env.GROQ_API_KEY || env.GEMINI_API_KEY ? "ok" : "warn", text: "Chatbot con IA (sin llaves responde un mensaje fijo)" },
  ];
}

export default async function SistemaPage() {
  await requirePageRole("superadmin");
  const db = createAdminClient();

  const count = async (table: string) => (await db.from(table).select("*", { count: "exact", head: true })).count ?? 0;
  const [
    { data: agent },
    { data: syncs },
    { data: attention },
    { data: audit },
    products,
    catalog,
    orders,
    movements,
    tracked,
    uncaptured,
  ] = await Promise.all([
    db.from("sync_config").select("*").eq("id", 1).maybeSingle(),
    db.from("sync_log").select("id, synced_at, products_synced, errors, duration_seconds, notes").order("synced_at", { ascending: false }).limit(8),
    db.from("orders").select("id, order_number, customer_name, total, notes, created_at").eq("order_status", "requires_attention").order("created_at", { ascending: false }).limit(10),
    db.from("audit_log").select("id, action, entity, entity_id, actor_email, created_at").order("created_at", { ascending: false }).limit(30),
    count("products"),
    count("eleventa_catalog"),
    count("orders"),
    count("stock_movements"),
    db.from("eleventa_catalog").select("*", { count: "exact", head: true }).eq("activo", true).eq("usa_inventario", true).then((r) => r.count ?? 0),
    db.from("orders").select("*", { count: "exact", head: true }).eq("payment_status", "paid").is("pos_registered_at", null).neq("order_status", "cancelled").then((r) => r.count ?? 0),
  ]);

  const heartbeatMin = agent?.last_heartbeat ? (Date.now() - new Date(agent.last_heartbeat).getTime()) / 60000 : Infinity;
  const agentLevel: Level = agent?.agent_status === "online" && heartbeatMin < 15 ? "ok" : heartbeatMin < 24 * 60 ? "warn" : "error";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Sistema</h1>
        <p className="text-muted-foreground text-sm mt-1">Solo soporte técnico. La tienda no ve esta página.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
          <h2 className="font-display font-semibold">Configuración</h2>
          <ul className="space-y-2">
            {configChecks().map((c) => <Status key={c.text} level={c.level}>{c.text}</Status>)}
          </ul>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
          <h2 className="font-display font-semibold">Agente de Eleventa (PC de la tienda)</h2>
          <ul className="space-y-2">
            <Status level={agentLevel}>
              {agent?.agent_status === "online" ? "En línea" : "Desconectado"} · último latido {ago(agent?.last_heartbeat ?? null)}
            </Status>
            <Status level={(agent?.pending_queue_count ?? 0) > 0 ? "warn" : "ok"}>
              Operaciones en cola sin enviar: {agent?.pending_queue_count ?? 0}
            </Status>
            <Status level={(agent?.last_sync_products ?? 0) > 0 ? "ok" : "warn"}>
              Productos leídos en el último ciclo: {agent?.last_sync_products ?? 0}
            </Status>
            <Status level={tracked > 0 ? "ok" : "warn"}>
              Productos con inventario controlado en Eleventa: {tracked.toLocaleString("es-MX")}
              {tracked === 0 && " — sin esto el stock web es manual (activar \"Usa inventario\" en Eleventa)"}
            </Status>
            <Status level={uncaptured > 0 ? "warn" : "ok"}>
              Ventas web pagadas sin capturar en Eleventa: {uncaptured}
            </Status>
          </ul>
          {(syncs ?? []).length > 0 && (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="text-left py-1">Ciclo</th><th className="text-right">Productos</th><th className="text-right">Errores</th><th className="text-right">Duración</th></tr>
              </thead>
              <tbody>
                {syncs!.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-1">{new Date(s.synced_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="text-right">{s.products_synced}</td>
                    <td className={`text-right ${s.errors ? "text-destructive font-medium" : ""}`}>{s.errors}</td>
                    <td className="text-right">{s.duration_seconds ?? "—"} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Productos web", products],
          ["Espejo Eleventa", catalog],
          ["Pedidos", orders],
          ["Movimientos de stock", movements],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-2xl border border-border shadow-sm p-4">
            <p className="font-display font-bold text-xl">{Number(value).toLocaleString("es-MX")}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
        <h2 className="font-display font-semibold">Pedidos que requieren atención</h2>
        {(attention ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguno.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {attention!.map((o) => (
              <li key={o.id} className="py-2 flex justify-between gap-3">
                <span>
                  <span className="font-mono text-xs">{o.order_number}</span> · {o.customer_name}
                  {o.notes && <span className="block text-xs text-muted-foreground">{o.notes}</span>}
                </span>
                <span className="font-semibold">${Number(o.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
        <h2 className="font-display font-semibold">Bitácora (últimos 30 cambios)</h2>
        {(audit ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {audit!.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{a.action}</span>{" "}
                  {a.entity === "product" && a.entity_id ? (
                    <Link href={`/admin/productos/${a.entity_id}/editar`} className="text-primary hover:underline">ver producto</Link>
                  ) : (
                    <span className="text-muted-foreground">{a.entity}</span>
                  )}
                  <span className="text-muted-foreground"> · {a.actor_email}</span>
                </span>
                <time className="text-xs text-muted-foreground whitespace-nowrap">{ago(a.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
