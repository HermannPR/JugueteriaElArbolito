"use client";

import { useState, useTransition } from "react";
import { publishAllReady } from "@/app/admin/actions";

/** Publica de una vez todos los listos (de la categoría filtrada, si hay). Solo administración. */
export default function PublishAllButton({ count, categoryId }: { count: number; categoryId: string | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => {
          const scope = categoryId ? " de esta categoría" : "";
          if (!window.confirm(`¿Publicar ${count.toLocaleString("es-MX")} producto${count !== 1 ? "s" : ""} listo${count !== 1 ? "s" : ""}${scope}? Aparecerán en la tienda en cuanto tengan stock. Puedes despublicarlos uno por uno.`)) return;
          setMessage(null);
          startTransition(async () => {
            const res = await publishAllReady(categoryId);
            setMessage(
              res.ok
                ? { ok: true, text: `Se publicaron ${(res.data?.published ?? 0).toLocaleString("es-MX")} productos.` }
                : { ok: false, text: res.error }
            );
          });
        }}
        disabled={pending || count === 0}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Publicando…" : `Publicar todos los listos (${count.toLocaleString("es-MX")})`}
      </button>
      {message && <span className={`text-sm ${message.ok ? "text-green-800" : "text-destructive"}`}>{message.text}</span>}
    </div>
  );
}
