"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ApproveButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function approve() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("products")
      .update({ is_approved: true, approved_at: new Date().toISOString(), approved_by: user?.id })
      .eq("id", productId);
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={approve}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline disabled:opacity-50"
    >
      <CheckCircle className="w-3 h-3" />
      {loading ? "..." : "Aprobar"}
    </button>
  );
}
