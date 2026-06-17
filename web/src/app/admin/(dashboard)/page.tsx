import { createClient } from "@/lib/supabase/server";
import { Package, ShoppingBag, CheckCircle, Clock } from "lucide-react";

async function getStats() {
  const supabase = await createClient();
  const [
    { count: totalProducts },
    { count: pendingApproval },
    { count: totalOrders },
    { count: pendingOrders },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_approved", false).eq("is_active", true),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_status", "pending"),
  ]);
  return { totalProducts, pendingApproval, totalOrders, pendingOrders };
}

async function getRecentOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, total, order_status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

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

export default async function AdminDashboard() {
  const [stats, recentOrders] = await Promise.all([getStats(), getRecentOrders()]);

  const cards = [
    { label: "Productos activos", value: stats.totalProducts ?? 0, icon: Package, color: "bg-blue-50 text-[#1E40AF]" },
    { label: "Pendientes de aprobación", value: stats.pendingApproval ?? 0, icon: Clock, color: "bg-amber-50 text-amber-700", href: "/admin/productos?estado=pendiente" },
    { label: "Pedidos totales", value: stats.totalOrders ?? 0, icon: ShoppingBag, color: "bg-green-50 text-green-700" },
    { label: "Pedidos pendientes", value: stats.pendingOrders ?? 0, icon: CheckCircle, color: "bg-purple-50 text-purple-700", href: "/admin/pedidos?estado=pending" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen general de la tienda</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, href }) => (
          <a
            key={label}
            href={href ?? "#"}
            className={`bg-white rounded-2xl border border-border p-5 space-y-3 shadow-sm ${href ? "hover:shadow-md transition-shadow cursor-pointer" : "cursor-default"}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-bold text-2xl">{value.toLocaleString("es-MX")}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{label}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display font-semibold">Pedidos recientes</h2>
          <a href="/admin/pedidos" className="text-sm text-[#1E40AF] hover:underline">Ver todos →</a>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">Sin pedidos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {["# Pedido", "Cliente", "Total", "Estado", "Fecha"].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface transition-colors">
                    <td className="px-6 py-3 font-medium font-mono text-xs">{order.order_number}</td>
                    <td className="px-6 py-3">{order.customer_name ?? "—"}</td>
                    <td className="px-6 py-3 font-semibold">
                      ${(order.total ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[order.order_status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABEL[order.order_status] ?? order.order_status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">
                      {new Date(order.created_at).toLocaleDateString("es-MX")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
