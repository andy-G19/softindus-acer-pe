import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { canAccessDashboardRoute } from "@/lib/permissions";

const protectedRoutePrefix = "/dashboard";
const authRoutes = ["/login"];

export const proxy = auth((request) => {
  // request.auth ya viene revalidado contra base de datos: los callbacks
  // jwt/session de src/auth.ts corren tambien para esta peticion, asi que
  // un usuario inactivo, eliminado o con rol cambiado llega aqui con
  // user.id/user.role vacios y user.status distinto de "activo".
  const sessionUser = request.auth?.user;
  const isSessionValid =
    Boolean(sessionUser?.id) && sessionUser?.status === "activo";
  const { pathname } = request.nextUrl;

  const isProtectedRoute = pathname.startsWith(protectedRoutePrefix);
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (!isSessionValid && isProtectedRoute) {
    const loginUrl = new URL("/login", request.nextUrl);

    if (sessionUser) {
      // Habia una cookie de sesion, pero quedo invalidada al revalidarla.
      loginUrl.searchParams.set("reason", "session-invalid");
    }

    return NextResponse.redirect(loginUrl);
  }

  if (isSessionValid && isAuthRoute) {
    const dashboardUrl = new URL("/dashboard", request.nextUrl);

    return NextResponse.redirect(dashboardUrl);
  }

  if (isSessionValid && isProtectedRoute) {
    const role = sessionUser?.role;

    const hasAccess = role ? canAccessDashboardRoute(role, pathname) : false;

    if (!hasAccess && pathname !== "/dashboard/access-denied") {
      const accessDeniedUrl = new URL(
        "/dashboard/access-denied",
        request.nextUrl,
      );

      return NextResponse.redirect(accessDeniedUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};