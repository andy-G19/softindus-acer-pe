export type NavigationCrumb = {
  label: string;
  href?: string;
};

export function dashboardBreadcrumbs(items: NavigationCrumb[]) {
  return [{ label: "Dashboard", href: "/dashboard" }, ...items];
}

export const navigationHrefs = {
  dashboard: "/dashboard",
  commercial: "/dashboard/commercial",
  clients: "/dashboard/commercial/clients",
  orders: "/dashboard/commercial/orders",
  inventory: "/dashboard/inventory",
  purchases: "/dashboard/inventory/purchases",
  production: "/dashboard/production",
  workOrders: "/dashboard/production/work-orders",
  bottlenecks: "/dashboard/production/bottlenecks",
} as const;
