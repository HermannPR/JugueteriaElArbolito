"use client";

import { useState, useTransition } from "react";
import { publishProduct, unpublishProduct } from "@/app/admin/actions";

export default function PublishButton({ productId, mode = "publish" }: { productId: string; mode?: "publish" | "unpublish" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const publish = mode === "publish";

  return (
    <span className="flex flex-col items-end">
      <button
        onClick={() => {
          if (!publish && !window.confirm("¿Retirar este producto de la tienda en línea?")) return;
          startTransition(async () => {
            const res = await (publish ? publishProduct(productId) : unpublishProduct(productId));
            if (!res.ok) setError(res.error);
          });
        }}
        disabled={pending}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 whitespace-nowrap ${
          publish ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border text-foreground hover:bg-surface"
        }`}
      >
        {publish ? (pending ? "Publicando…" : "Publicar") : pending ? "Retirando…" : "Despublicar"}
      </button>
      {error && <span className="text-[11px] text-destructive mt-1 max-w-40 text-right">{error}</span>}
    </span>
  );
}
