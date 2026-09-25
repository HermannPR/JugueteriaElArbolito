"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, LogOut, TreePine, X, Users, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, hasRole, type Role } from "@/lib/roles";

const NAV: Array<{ href: string; label: string; icon: typeof Package; min: Role; exact?: boolean }> = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, min: "staff", exact: true },
  { href: "/admin/productos", label: "Productos", icon: Package, min: "staff" },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag, min: "admin" },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, min: "admin" },
  { href: "/admin/sistema", label: "Sistema", icon: Activity, min: "superadmin" },
];

interface Props {
  email: string;
  role: Role;
  onClose?: () => void;
}

export default function AdminSidebar({ email, role, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="h-full flex flex-col bg-primary text-primary-foreground w-64">
      <div className="flex items-center justify-between p-5 border-b border-white/20">
        <div className="flex items-center gap-2">
          <TreePine className="w-6 h-6" />
          <div>
            <p className="font-display font-bold text-base leading-none">El Arbolito</p>
            <p className="text-white/60 text-xs">Panel de la tienda</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white" aria-label="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.filter((item) => hasRole(role, item.min)).map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/20 space-y-2">
        <div className="px-3 text-xs">
          <p className="text-white truncate" title={email}>{email}</p>
          <p className="text-white/60">{ROLE_LABEL[role]}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
