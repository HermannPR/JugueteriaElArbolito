import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRole, type Role } from "@/lib/roles";

export interface PanelUser {
  id: string;
  email: string;
  role: Role;
}

/** Usuario de la sesión con su rol, o null si no hay sesión. */
export async function getPanelUser(): Promise<PanelUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return { id: user.id, email: user.email ?? "", role: (profile?.role as Role) ?? "customer" };
}

/** Para páginas del panel: redirige al login si el rol no alcanza. */
export async function requirePageRole(min: Role): Promise<PanelUser> {
  const user = await getPanelUser();
  if (!user) redirect("/admin/login");
  if (!hasRole(user.role, min)) redirect("/admin?error=sin_permiso");
  return user;
}

export class PermissionError extends Error {}

/** Para server actions: lanza si el rol no alcanza (nunca confiar en que el botón estaba oculto). */
export async function requireActionRole(min: Role): Promise<PanelUser> {
  const user = await getPanelUser();
  if (!user || !hasRole(user.role, min)) {
    throw new PermissionError("No tienes permiso para esta acción.");
  }
  return user;
}
