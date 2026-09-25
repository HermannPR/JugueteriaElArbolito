import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role: ignora RLS. Solo para código de servidor que
 * necesita escribir pedidos o mover stock (checkout, webhook, cron).
 * El import de "server-only" rompe el build si alguien lo importa en el navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
