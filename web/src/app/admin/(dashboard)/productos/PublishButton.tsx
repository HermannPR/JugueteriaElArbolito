"use client";

import { useState, useTransition } from "react";
import { publishProduct } from "@/app/admin/actions";

export default function PublishButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="flex flex-col items-end">
      <button
        onClick={() =>
          startTransition(async () => {
            const res = await publishProduct(productId);
            if (!res.ok) setError(res.error);
          })
        }
        disabled={pending}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
      >
        {pending ? "Publicando…" : "Publicar"}
      </button>
      {error && <span className="text-[11px] text-destructive mt-1 max-w-40 text-right">{error}</span>}
    </span>
  );
}
