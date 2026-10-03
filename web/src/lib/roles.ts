// Roles del panel. Deben coincidir con role_rank() en
// supabase/migrations/20260925000003_roles_and_audit.sql.
export type Role = "customer" | "staff" | "admin" | "superadmin";

export const ROLE_RANK: Record<Role, number> = { customer: 0, staff: 1, admin: 2, superadmin: 3 };

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Cliente",
  staff: "Empleado",
  admin: "Administrador",
  superadmin: "Superadmin",
};

export function hasRole(role: Role | null | undefined, min: Role): boolean {
  return ROLE_RANK[role ?? "customer"] >= ROLE_RANK[min];
}

// Rutas del panel que exigen más que "staff". El middleware y el menú usan esto.
export const ROUTE_MIN_ROLE: Array<[prefix: string, role: Role]> = [
  ["/admin/sistema", "superadmin"],
  ["/admin/pedidos", "admin"],
  ["/admin/fotos", "admin"],
  ["/admin", "staff"],
];

export function minRoleForPath(pathname: string): Role {
  return ROUTE_MIN_ROLE.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "staff";
}
