"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TreePine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Credenciales incorrectas.");
      setLoading(false);
      return;
    }

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user!.id)
      .single();

    if (!profile?.is_admin) {
      await supabase.auth.signOut();
      setError("Esta cuenta no tiene acceso al panel.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1E40AF] rounded-xl mb-4">
            <TreePine className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl">Panel Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Juguetería El Arbolito</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-border p-6 space-y-4 shadow-sm">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">Correo</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full bg-[#1E40AF] hover:bg-[#1e3a8a]" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
