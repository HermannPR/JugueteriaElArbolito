import { createClient } from "@/lib/supabase/server";
import OrderStatusSelect from "./OrderStatusSelect";

interface SearchParams {
  estado?: string;
  q?: string;
  pagina?: string;
  [key: string]: string | undefined;
}

const PAGE_SIZE = 30;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  processing: "En proceso",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

async function getOrders(params: SearchParams) {
  const supabase = await createClient();
  const page = Number(params.pagina ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_email, total, order_status, payment_status, factura_solicitada, created_at", { count: "exact" });

  if (params.estado) query = query.eq("order_status", params.estado);
  if (params.q) {
    query = query.or(`order_number.ilike.%${params.q}%,customer_name.ilike.%${params.q}%,customer_email.ilike.%${params.q}%`);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count } = await query;
  return { orders: data ?? [], total: count ?? 0 };
}

export default async function AdminPedidosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { orders, total } = await getOrders(params);
  const page = Number(params.pagina ?? 1);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const ESTADOS = [
    { key: "", label: "Todos" },
    { key: "pending", label: "Pendientes" },
    { key: "paid", label: "Pagados" },
    { key: "processing", label: "En proceso" },
    { key: "shipped", label: "Enviados" },
    { key: "delivered", label: "Entregados" },
    { key: "cancelled", label: "Cancelados" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Pedidos</h1>
        <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString("es-MX")} pedido{total !== 1 ? "s" : ""}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex flex-wrap gap-1">
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
            placeholder="Buscar por # pedido, cliente o correo..."
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          />
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-16 text-sm">Sin pedidos con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {["# Pedido", "Cliente", "Total", "Pago", "Estado", "Factura", "Fecha", "Cambiar estado"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{order.order_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.customer_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      ${(order.total ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.payment_status === "paid" ? "bg-green-100 text-green-800" :
                        order.payment_status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {order.payment_status === "paid" ? "Pagado" : order.payment_status === "pending" ? "Pendiente" : order.payment_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.order_status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABEL[order.order_status] ?? order.order_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.factura_solicitada ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Sí</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusSelect orderId={order.id} currentStatus={order.order_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
