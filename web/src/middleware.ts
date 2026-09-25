import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasRole, minRoleForPath, type Role } from "@/lib/roles";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";

  const role: Role | null = user
    ? (((await supabase.from("user_profiles").select("role").eq("user_id", user.id).maybeSingle()).data?.role as Role) ?? "customer")
    : null;

  if (!isLoginPage) {
    if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));
    if (!hasRole(role, "staff")) return NextResponse.redirect(new URL("/admin/login?error=no_access", request.url));
    if (!hasRole(role, minRoleForPath(pathname))) return NextResponse.redirect(new URL("/admin?error=sin_permiso", request.url));
  } else if (hasRole(role, "staff")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
