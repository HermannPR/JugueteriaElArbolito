"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Link as LinkIcon, Loader2 } from "lucide-react";

export default function ImageJobActions({ productId, productName }: { productId: string; productName: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // Create image_job record
    await supabase.from("image_jobs").insert({
      product_id: productId,
      source_url: url.trim(),
      status: "pending",
      priority: 5,
    });

    // Call Edge Function
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ product_id: productId, source_url: url.trim() }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Error al procesar");
    } else {
      setUrl("");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="flex gap-2 items-center min-w-64">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        title={`Importar imagen para: ${productName}`}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImport(); } }}
      />
      <button
        onClick={handleImport}
        disabled={loading || !url.trim()}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline disabled:opacity-40 shrink-0"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
        {loading ? "..." : "Importar"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
