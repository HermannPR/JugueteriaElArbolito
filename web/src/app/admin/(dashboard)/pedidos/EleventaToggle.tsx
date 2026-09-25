"use client";

import { useState, useTransition } from "react";
import { setOrderRegisteredInEleventa } from "@/app/admin/actions";

// Una venta web pagada debe capturarse también en Eleventa. Mientras no se marque,
// la sincronización la sigue descontando del stock web para no sobrevender.
export default function EleventaToggle({ orderId, registered }: { orderId: string; registered: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle(next: boolean) {
    setError("");
    startTransition(async () => {
      const res = await setOrderRegisteredInEleventa(orderId, next);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <span className="inline-flex flex-col">
      {registered ? (
        <button onClick={() => toggle(false)} disabled={pending} className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50 whitespace-nowrap" title="Deshacer">
          ✓ Capturado
        </button>
      ) : (
        <button onClick={() => toggle(true)} disabled={pending} className="text-xs font-medium px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 whitespace-nowrap">
          {pending ? "…" : "Marcar capturado"}
        </button>
      )}
      {error && <span className="text-[11px] text-destructive mt-1">{error}</span>}
    </span>
  );
}
