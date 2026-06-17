"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "processing", label: "En proceso" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];

export default function OrderStatusSelect({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("orders").update({ order_status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
    router.refresh();
    setSaving(false);
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={saving}
      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-[#3B82F6] disabled:opacity-50"
    >
      {STATUSES.map(({ value, label }) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
