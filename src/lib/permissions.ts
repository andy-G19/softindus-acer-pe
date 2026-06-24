export const APP_ROLES = {
  ADMIN: "ADMIN",
  SELLER: "SELLER",
  WORKSHOP_MASTER: "WORKSHOP_MASTER",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export type AppUserStatus = "activo" | "inactivo" | "bloqueado";

export const roleLabels: Record<AppRole, string> = {
  ADMIN: "Administrador",
  SELLER: "Vendedor",
  WORKSHOP_MASTER: "Maestro de taller",
};

export const userStatusLabels: Record<AppUserStatus, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  bloqueado: "Bloqueado",
};

type DashboardRoute = {
  title: string;
  href: string;
  roles: AppRole[];
};

export const dashboardRoutes: DashboardRoute[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    roles: [APP_ROLES.ADMIN, APP_ROLES.SELLER, APP_ROLES.WORKSHOP_MASTER],
  },
  {
    title: "Usuarios",
    href: "/dashboard/users",
    roles: [APP_ROLES.ADMIN],
  },
  {
    title: "Comercial",
    href: "/dashboard/commercial",
    roles: [APP_ROLES.ADMIN, APP_ROLES.SELLER],
  },
  {
    title: "Inventario",
    href: "/dashboard/inventory",
    roles: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
  },
  {
    title: "Producción",
    href: "/dashboard/production",
    roles: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
  },
  {
    title: "Costos",
    href: "/dashboard/costs",
    roles: [APP_ROLES.ADMIN],
  },
  {
    title: "Acceso denegado",
    href: "/dashboard/access-denied",
    roles: [APP_ROLES.ADMIN, APP_ROLES.SELLER, APP_ROLES.WORKSHOP_MASTER],
  },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function isAppRole(role: string): role is AppRole {
  return Object.values(APP_ROLES).includes(role as AppRole);
}

export function getRoleLabel(role: string) {
  if (!isAppRole(role)) {
    return role;
  }

  return roleLabels[role];
}

export function getUserStatusLabel(status: string) {
  return userStatusLabels[status as AppUserStatus] ?? status;
}

export function getMenuForRole(role: string) {
  if (!isAppRole(role)) {
    return [];
  }

  return dashboardRoutes.filter((route) => {
    if (route.href === "/dashboard/access-denied") {
      return false;
    }

    return route.roles.includes(role);
  });
}

export function canAccessDashboardRoute(role: string, pathname: string) {
  if (!isAppRole(role)) {
    return false;
  }

  const normalizedPathname = normalizePath(pathname);

  const matchedRoute = dashboardRoutes
    .filter((route) => {
      return (
        normalizedPathname === route.href ||
        normalizedPathname.startsWith(`${route.href}/`)
      );
    })
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!matchedRoute) {
    return false;
  }

  return matchedRoute.roles.includes(role);
}