import { requirePageRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { CreateUserForm, RoleSelect } from "./UserControls";

export default async function UsuariosPage() {
  const me = await requirePageRole("admin");
  const db = createAdminClient();

  // Los correos viven en auth.users; los roles en user_profiles.
  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    db.from("user_profiles").select("user_id, full_name, role, created_at").neq("role", "customer").order("created_at"),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const byId = new Map((authUsers?.users ?? []).map((u) => [u.id, u]));
  const assignable: Role[] = me.role === "superadmin" ? ["staff", "admin", "superadmin", "customer"] : ["staff", "customer"];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl">Usuarios del panel</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Empleados: fotos, categorías y publicar. Administración: además stock, precios, bloqueos y pedidos.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <ul className="divide-y divide-border">
          {(profiles ?? []).map((p) => {
            const u = byId.get(p.user_id);
            const role = p.role as Role;
            const locked = p.user_id === me.id || (me.role !== "superadmin" && role !== "staff");
            return (
              <li key={p.user_id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.full_name || u?.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u?.email}
                    {u?.last_sign_in_at && ` · último acceso ${new Date(u.last_sign_in_at).toLocaleDateString("es-MX")}`}
                  </p>
                </div>
                {locked ? (
                  <span className="text-xs text-muted-foreground">{ROLE_LABEL[role]}{p.user_id === me.id && " (tú)"}</span>
                ) : (
                  <RoleSelect userId={p.user_id} current={role} options={assignable} />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <CreateUserForm options={assignable.filter((r) => r !== "customer")} />
    </div>
  );
}
