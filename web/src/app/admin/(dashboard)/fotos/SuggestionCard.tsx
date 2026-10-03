"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, ImageOff } from "lucide-react";
import { acceptPhotoSuggestion, discardPhotoSuggestion, previewPhotoSuggestion } from "@/app/admin/actions";

interface Props {
  suggestionId: string;
  productName: string;
  sku: string;
  price: number;
  stock: number;
  fuente: string | null;
  motivo: string | null;
  pageUrl: string;
  editHref: string;
}

export default function SuggestionCard({ suggestionId, productName, sku, price, stock, fuente, motivo, pageUrl, editHref }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<"accepted" | "discarded" | null>(null);
  const [pending, startTransition] = useTransition();

  // La vista previa se resuelve en el servidor (la ficha declara su foto en og:image).
  useEffect(() => {
    let cancelled = false;
    previewPhotoSuggestion(suggestionId).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setPreview(res.data.image_url);
      else setPreviewError(res.ok ? "Sin vista previa." : res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  function decide(accept: boolean) {
    setError("");
    startTransition(async () => {
      const res = await (accept ? acceptPhotoSuggestion(suggestionId) : discardPhotoSuggestion(suggestionId));
      if (res.ok) setDone(accept ? "accepted" : "discarded");
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <li className="bg-white rounded-2xl border border-border p-4 text-sm text-muted-foreground">
        {done === "accepted" ? "✓ Foto guardada en " : "Sugerencia descartada para "}
        <span className="font-medium text-foreground">{productName}</span>
      </li>
    );
  }

  return (
    <li className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-square bg-surface flex items-center justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Foto sugerida para ${productName}`} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        ) : previewError ? (
          <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground px-4 text-center">
            <ImageOff className="w-6 h-6" />
            {previewError}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Cargando vista previa…</span>
        )}
      </div>
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <Link href={editHref} className="font-medium text-sm line-clamp-2 hover:underline">{productName}</Link>
        <p className="text-xs text-muted-foreground font-mono">{sku}</p>
        <p className="text-xs text-muted-foreground">
          ${price.toLocaleString("es-MX", { minimumFractionDigits: 2 })} · {stock} en stock
        </p>
        {motivo && <p className="text-xs">{motivo}</p>}
        <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
          <ExternalLink className="w-3 h-3" /> Ver ficha{fuente ? ` (${fuente})` : ""}
        </a>
        <div className="flex gap-2 pt-2 mt-auto">
          <button
            onClick={() => decide(true)}
            disabled={pending || !preview}
            className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Aceptar"}
          </button>
          <button
            onClick={() => decide(false)}
            disabled={pending}
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </li>
  );
}
