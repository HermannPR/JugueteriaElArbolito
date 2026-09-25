"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/app/admin/actions";
import { ORDER_STATUS_LABEL } from "@/lib/catalog-status";

export default function OrderStatusSelect({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col">
      <select
        defaultValue={currentStatus}
        disabled={pending}
        aria-label="Estado del pedido"
        onChange={(e) => {
          const status = e.target.value;
          setError("");
          startTransition(async () => {
            const res = await updateOrderStatus(orderId, status);
            if (!res.ok) setError(res.error);
          });
        }}
        className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {error && <span className="text-[11px] text-destructive mt-1">{error}</span>}
    </span>
  );
}
