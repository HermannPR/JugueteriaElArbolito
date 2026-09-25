"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPanelUser, setUserRole } from "@/app/admin/actions";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export function RoleSelect({ userId, current, options }: { userId: string; current: Role; options: Role[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col items-end">
      <select
        defaultValue={current}
        disabled={pending}
        aria-label="Rol"
        className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white"
        onChange={(e) => {
          const role = e.target.value as Role;
          if (role === "customer" && !confirm("¿Quitar el acceso al panel a esta persona?")) {
            e.target.value = current;
            return;
          }
          setError("");
          startTransition(async () => {
            const res = await setUserRole(userId, role);
            if (!res.ok) setError(res.error);
          });
        }}
      >
        {options.map((r) => (
          <option key={r} value={r}>{r === "customer" ? "Sin acceso" : ROLE_LABEL[r]}</option>
        ))}
      </select>
      {error && <span className="text-[11px] text-destructive mt-1">{error}</span>}
    </span>
  );
}

export function CreateUserForm({ options }: { options: Role[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "staff" as Role });

  return (
    <form
      className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        setDone("");
        startTransition(async () => {
          const res = await createPanelUser(form);
          if (res.ok) {
            setDone(`Cuenta creada. Comparte la contraseña con ${form.email} en persona.`);
            setForm({ full_name: "", email: "", password: "", role: "staff" });
          } else setError(res.error);
        });
      }}
    >
      <h2 className="font-display font-semibold">Dar de alta a alguien</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input placeholder="Nombre" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        <Input placeholder="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Input placeholder="Contraseña temporal (mín. 10 caracteres)" type="text" minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="off" />
        <select className="text-sm border border-border rounded-lg px-3 py-2 bg-white" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {options.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {done && <p className="text-sm text-green-700">{done}</p>}
      </div>
    </form>
  );
}
