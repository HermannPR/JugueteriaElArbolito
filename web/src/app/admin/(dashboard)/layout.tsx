import { requirePageRole } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("staff");
  return (
    <AdminShell email={user.email} role={user.role}>
      {children}
    </AdminShell>
  );
}
