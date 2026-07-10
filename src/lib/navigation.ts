export type NavigationCrumb = {
  label: string;
  href?: string;
};

export function dashboardBreadcrumbs(items: NavigationCrumb[]) {
  return [{ label: "Dashboard", href: "/dashboard" }, ...items];
}

export type SearchParamsInput = Record<
  string,
  string | string[] | undefined
>;

export function getSearchParam(params: SearchParamsInput, key: string) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export function createQueryString(
  params: SearchParamsInput,
  excludedKeys: string[] = [],
) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (excludedKeys.includes(key)) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) {
          search.append(key, entry);
        }
      });
      return;
    }

    if (value) {
      search.set(key, value);
    }
  });

  return search.toString();
}

export function createReturnToHref(
  pathname: string,
  params: SearchParamsInput,
  excludedKeys: string[] = ["returnTo"],
) {
  const queryString = createQueryString(params, excludedKeys);
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function getSafeReturnTo(
  value: string | string[] | undefined,
  fallbackHref: string,
) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return fallbackHref;
  }

  try {
    const decoded = decodeURIComponent(candidate);

    if (!decoded.startsWith("/dashboard")) {
      return fallbackHref;
    }

    if (decoded.startsWith("//")) {
      return fallbackHref;
    }

    if (decoded.includes("://")) {
      return fallbackHref;
    }

    return decoded;
  } catch {
    return fallbackHref;
  }
}

export function withReturnTo(href: string, returnTo?: string) {
  if (!returnTo) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export const navigationHrefs = {
  dashboard: "/dashboard",
  audit: "/dashboard/audit",
  users: "/dashboard/users",

  commercial: "/dashboard/commercial",
  clients: "/dashboard/commercial/clients",
  products: "/dashboard/commercial/products",
  orders: "/dashboard/commercial/orders",
  quotes: "/dashboard/commercial/quotes",
  customerPayments: "/dashboard/commercial/payments",
  salesReceipts: "/dashboard/commercial/receipts",
  productCategories: "/dashboard/commercial/product-categories",

  inventory: "/dashboard/inventory",
  materials: "/dashboard/inventory/materials",
  materialCategories: "/dashboard/inventory/material-categories",
  suppliers: "/dashboard/inventory/suppliers",
  supplierMaterials: "/dashboard/inventory/supplier-materials",
  purchases: "/dashboard/inventory/purchases",
  inventoryEntries: "/dashboard/inventory/entries",
  inventoryOutputs: "/dashboard/inventory/outputs",
  inventoryAlerts: "/dashboard/inventory/alerts",
  supplierPayments: "/dashboard/inventory/supplier-payments",
  supplierTypes: "/dashboard/inventory/supplier-types",

  production: "/dashboard/production",
  workOrders: "/dashboard/production/work-orders",
  routes: "/dashboard/production/routes",
  recipes: "/dashboard/production/recipes",
  campaigns: "/dashboard/production/campaigns",
  bottlenecks: "/dashboard/production/bottlenecks",

  wasteScrap: "/dashboard/waste-scrap",
  scraps: "/dashboard/waste-scrap/scraps",
  reusableScraps: "/dashboard/waste-scrap/reusable-scraps",
  scrapSales: "/dashboard/waste-scrap/scrap-sales",

  costs: "/dashboard/costs",
  costings: "/dashboard/costs/costings",
  costWorkOrders: "/dashboard/costs/work-orders",

  pettyCash: "/dashboard/petty-cash",
  pettyCashBoxes: "/dashboard/petty-cash/boxes",
  pettyCashCategories: "/dashboard/petty-cash/categories",
  pettyCashExpenses: "/dashboard/petty-cash/expenses",
  pettyCashIncomeAdjustments: "/dashboard/petty-cash/income-adjustments",
  pettyCashMonthlySummary: "/dashboard/petty-cash/monthly-summary",
  pettyCashMovements: "/dashboard/petty-cash/movements",

  staff: "/dashboard/staff",
  operators: "/dashboard/staff/operators",
  attendance: "/dashboard/staff/attendance",
  tasks: "/dashboard/staff/tasks",
  payrolls: "/dashboard/staff/payrolls",
  paymentHistory: "/dashboard/staff/payment-history",

  maintenance: "/dashboard/maintenance",
  machines: "/dashboard/maintenance/machines",
  spareParts: "/dashboard/maintenance/spare-parts",
  failures: "/dashboard/maintenance/failures",
  preventiveMaintenance: "/dashboard/maintenance/preventive",
  repairs: "/dashboard/maintenance/repairs",
  recurrences: "/dashboard/maintenance/recurrences",

  reports: "/dashboard/reports",
  salesCollectionsReport: "/dashboard/reports/sales-collections",
  inventoryReport: "/dashboard/reports/inventory",
  productionReport: "/dashboard/reports/production",
  maintenanceReport: "/dashboard/reports/maintenance",
  suppliersPurchasesReport: "/dashboard/reports/suppliers-purchases",
  financialReport: "/dashboard/reports/financial",
  profitabilityReport: "/dashboard/reports/profitability",
  staffReport: "/dashboard/reports/staff",
  exportHistory: "/dashboard/reports/export-history",
} as const;
