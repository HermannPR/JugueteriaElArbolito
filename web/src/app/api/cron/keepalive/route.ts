import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Llamado una vez al día por Vercel Cron (ver vercel.json).
 * Un proyecto Supabase gratuito se pausa tras ~7 días sin actividad; esta
 * consulta lo mantiene activo aunque la PC de la tienda (el agente) esté apagada.
 * Vercel manda "Authorization: Bearer <CRON_SECRET>" automáticamente.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await createAdminClient()
    .from("sync_config")
    .select("agent_status, last_heartbeat")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Keep-alive: Supabase no respondió:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, agent: data });
}
