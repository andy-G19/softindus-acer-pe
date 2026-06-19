import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { canAccessDashboardRoute } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";

const protectedRoutePrefix = "/dashboard";
const authRoutes = ["/login"];

export const proxy = auth((request) => {
  const isLoggedIn = Boolean(request.auth?.user);
  const { pathname } = request.nextUrl;

  const isProtectedRoute = pathname.startsWith(protectedRoutePrefix);
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (!isLoggedIn && isProtectedRoute) {
    const loginUrl = new URL("/login", request.nextUrl);

    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthRoute) {
    const dashboardUrl = new URL("/dashboard", request.nextUrl);

    return NextResponse.redirect(dashboardUrl);
  }

  if (isLoggedIn && isProtectedRoute) {
    const role = request.auth?.user?.role as UserRole | undefined;

    const hasAccess = role
      ? canAccessDashboardRoute(role, pathname)
      : false;

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