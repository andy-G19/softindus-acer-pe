# Inventario estructural para la refactorización

Generado con `npm run refactor:inventory`. No editar las tablas a mano.

Este inventario analiza el árbol sintáctico de `src`, excluyendo el cliente generado. Cuenta declaraciones JSX de formularios, incluidos filtros y acciones por fila; no equivale al número de pantallas de alta/edición. Los componentes importados son candidatos por nombre y requieren clasificación funcional en el piloto. El seguimiento manual se mantiene en `SEGUIMIENTO.md`.

| Medida | Cantidad |
| --- | --- |
| Archivos fuente analizados | 915 |
| Páginas | 179 |
| Páginas en ranuras paralelas (@ranura) | 53 |
| Páginas que interceptan una ruta | 33 |
| Declaraciones JSX de formulario | 35 |
| Archivos con directiva use server | 48 |
| Funciones exportadas en esos archivos | 111 |

## Páginas por área

| Área | Páginas |
| --- | --- |
| access-denied | 1 |
| audit | 1 |
| auth | 1 |
| commercial | 23 |
| costs | 4 |
| gallery | 1 |
| inicio | 2 |
| inventory | 29 |
| maintenance | 24 |
| petty-cash | 9 |
| production | 39 |
| reports | 10 |
| staff | 19 |
| users | 6 |
| waste-scrap | 10 |

## Rutas y formularios candidatos

La ruta es la URL. Una página en una ranura paralela se pinta en esa ranura del layout; si intercepta su ruta, es el panel que abre la navegación desde el listado, y la URL directa o una recarga muestran la página completa de la misma ruta.

| Ruta | Ranura | Fuente | Formularios inline | Componentes candidatos |
| --- | --- | --- | --- | --- |
| `/login` | — | `src/app/(auth)/login/page.tsx` | 0 | LoginForm |
| `/dashboard/access-denied` | — | `src/app/(dashboard)/dashboard/access-denied/page.tsx` | 0 | — |
| `/dashboard/audit` | — | `src/app/(dashboard)/dashboard/audit/page.tsx` | 0 | — |
| `/dashboard/commercial/clients/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/commercial/clients/@panel/(.)[id]/edit/page.tsx` | 0 | ClientForm |
| `/dashboard/commercial/clients/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/commercial/clients/@panel/(.)new/page.tsx` | 0 | ClientForm |
| `/dashboard/commercial/clients` | `@panel` | `src/app/(dashboard)/dashboard/commercial/clients/@panel/page.tsx` | 0 | — |
| `/dashboard/commercial/clients/[id]/edit` | — | `src/app/(dashboard)/dashboard/commercial/clients/[id]/edit/page.tsx` | 0 | ClientForm |
| `/dashboard/commercial/clients/new` | — | `src/app/(dashboard)/dashboard/commercial/clients/new/page.tsx` | 0 | ClientForm |
| `/dashboard/commercial/clients` | — | `src/app/(dashboard)/dashboard/commercial/clients/page.tsx` | 0 | — |
| `/dashboard/commercial/orders/[id]/edit` | — | `src/app/(dashboard)/dashboard/commercial/orders/[id]/edit/page.tsx` | 0 | OrderForm |
| `/dashboard/commercial/orders/[id]` | — | `src/app/(dashboard)/dashboard/commercial/orders/[id]/page.tsx` | 0 | — |
| `/dashboard/commercial/orders/new` | — | `src/app/(dashboard)/dashboard/commercial/orders/new/page.tsx` | 0 | OrderForm |
| `/dashboard/commercial/orders` | — | `src/app/(dashboard)/dashboard/commercial/orders/page.tsx` | 1 | — |
| `/dashboard/commercial` | — | `src/app/(dashboard)/dashboard/commercial/page.tsx` | 0 | — |
| `/dashboard/commercial/payments` | — | `src/app/(dashboard)/dashboard/commercial/payments/page.tsx` | 0 | — |
| `/dashboard/commercial/product-categories` | — | `src/app/(dashboard)/dashboard/commercial/product-categories/page.tsx` | 0 | ProductCategoryManager |
| `/dashboard/commercial/products/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/commercial/products/@panel/(.)[id]/edit/page.tsx` | 0 | ProductForm |
| `/dashboard/commercial/products/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/commercial/products/@panel/(.)new/page.tsx` | 0 | ProductForm |
| `/dashboard/commercial/products` | `@panel` | `src/app/(dashboard)/dashboard/commercial/products/@panel/page.tsx` | 0 | — |
| `/dashboard/commercial/products/[id]/edit` | — | `src/app/(dashboard)/dashboard/commercial/products/[id]/edit/page.tsx` | 0 | ProductForm |
| `/dashboard/commercial/products/new` | — | `src/app/(dashboard)/dashboard/commercial/products/new/page.tsx` | 0 | ProductForm |
| `/dashboard/commercial/products` | — | `src/app/(dashboard)/dashboard/commercial/products/page.tsx` | 0 | — |
| `/dashboard/commercial/quotes/[id]` | — | `src/app/(dashboard)/dashboard/commercial/quotes/[id]/page.tsx` | 1 | ReceiptForm, PaymentForm |
| `/dashboard/commercial/quotes/new` | — | `src/app/(dashboard)/dashboard/commercial/quotes/new/page.tsx` | 0 | QuoteForm |
| `/dashboard/commercial/quotes` | — | `src/app/(dashboard)/dashboard/commercial/quotes/page.tsx` | 1 | — |
| `/dashboard/commercial/receipts` | — | `src/app/(dashboard)/dashboard/commercial/receipts/page.tsx` | 1 | — |
| `/dashboard/costs/costings/[id]` | — | `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 0 | — |
| `/dashboard/costs/costings` | — | `src/app/(dashboard)/dashboard/costs/costings/page.tsx` | 0 | — |
| `/dashboard/costs` | — | `src/app/(dashboard)/dashboard/costs/page.tsx` | 0 | — |
| `/dashboard/costs/work-orders` | — | `src/app/(dashboard)/dashboard/costs/work-orders/page.tsx` | 0 | — |
| `/dashboard/gallery` | — | `src/app/(dashboard)/dashboard/gallery/page.tsx` | 0 | — |
| `/dashboard/inventory/alerts` | — | `src/app/(dashboard)/dashboard/inventory/alerts/page.tsx` | 0 | — |
| `/dashboard/inventory/entries` | — | `src/app/(dashboard)/dashboard/inventory/entries/page.tsx` | 0 | — |
| `/dashboard/inventory/material-categories` | — | `src/app/(dashboard)/dashboard/inventory/material-categories/page.tsx` | 0 | InventoryCatalogManager |
| `/dashboard/inventory/materials/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/inventory/materials/@panel/(.)[id]/edit/page.tsx` | 0 | MaterialForm |
| `/dashboard/inventory/materials/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/inventory/materials/@panel/(.)new/page.tsx` | 0 | MaterialForm |
| `/dashboard/inventory/materials` | `@panel` | `src/app/(dashboard)/dashboard/inventory/materials/@panel/page.tsx` | 0 | — |
| `/dashboard/inventory/materials/[id]/edit` | — | `src/app/(dashboard)/dashboard/inventory/materials/[id]/edit/page.tsx` | 0 | MaterialForm |
| `/dashboard/inventory/materials/new` | — | `src/app/(dashboard)/dashboard/inventory/materials/new/page.tsx` | 0 | MaterialForm |
| `/dashboard/inventory/materials` | — | `src/app/(dashboard)/dashboard/inventory/materials/page.tsx` | 0 | — |
| `/dashboard/inventory/outputs/new` | — | `src/app/(dashboard)/dashboard/inventory/outputs/new/page.tsx` | 0 | InventoryOutputForm |
| `/dashboard/inventory/outputs` | — | `src/app/(dashboard)/dashboard/inventory/outputs/page.tsx` | 0 | — |
| `/dashboard/inventory` | — | `src/app/(dashboard)/dashboard/inventory/page.tsx` | 0 | — |
| `/dashboard/inventory/purchases/[id]` | — | `src/app/(dashboard)/dashboard/inventory/purchases/[id]/page.tsx` | 0 | SupplierPaymentForm |
| `/dashboard/inventory/purchases/new` | — | `src/app/(dashboard)/dashboard/inventory/purchases/new/page.tsx` | 0 | PurchaseForm |
| `/dashboard/inventory/purchases` | — | `src/app/(dashboard)/dashboard/inventory/purchases/page.tsx` | 0 | — |
| `/dashboard/inventory/supplier-materials/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/inventory/supplier-materials/@panel/(.)[id]/edit/page.tsx` | 0 | SupplierMaterialForm |
| `/dashboard/inventory/supplier-materials/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/inventory/supplier-materials/@panel/(.)new/page.tsx` | 0 | SupplierMaterialForm |
| `/dashboard/inventory/supplier-materials` | `@panel` | `src/app/(dashboard)/dashboard/inventory/supplier-materials/@panel/page.tsx` | 0 | — |
| `/dashboard/inventory/supplier-materials/[id]/edit` | — | `src/app/(dashboard)/dashboard/inventory/supplier-materials/[id]/edit/page.tsx` | 0 | SupplierMaterialForm |
| `/dashboard/inventory/supplier-materials/new` | — | `src/app/(dashboard)/dashboard/inventory/supplier-materials/new/page.tsx` | 0 | SupplierMaterialForm |
| `/dashboard/inventory/supplier-materials` | — | `src/app/(dashboard)/dashboard/inventory/supplier-materials/page.tsx` | 0 | — |
| `/dashboard/inventory/supplier-payments` | — | `src/app/(dashboard)/dashboard/inventory/supplier-payments/page.tsx` | 0 | — |
| `/dashboard/inventory/supplier-types` | — | `src/app/(dashboard)/dashboard/inventory/supplier-types/page.tsx` | 0 | InventoryCatalogManager |
| `/dashboard/inventory/suppliers/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/inventory/suppliers/@panel/(.)[id]/edit/page.tsx` | 0 | SupplierForm |
| `/dashboard/inventory/suppliers/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/inventory/suppliers/@panel/(.)new/page.tsx` | 0 | SupplierForm |
| `/dashboard/inventory/suppliers` | `@panel` | `src/app/(dashboard)/dashboard/inventory/suppliers/@panel/page.tsx` | 0 | — |
| `/dashboard/inventory/suppliers/[id]/edit` | — | `src/app/(dashboard)/dashboard/inventory/suppliers/[id]/edit/page.tsx` | 0 | SupplierForm |
| `/dashboard/inventory/suppliers/new` | — | `src/app/(dashboard)/dashboard/inventory/suppliers/new/page.tsx` | 0 | SupplierForm |
| `/dashboard/inventory/suppliers` | — | `src/app/(dashboard)/dashboard/inventory/suppliers/page.tsx` | 0 | — |
| `/dashboard/maintenance/failures/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/maintenance/failures/@panel/(.)new/page.tsx` | 0 | FailureForm |
| `/dashboard/maintenance/failures` | `@panel` | `src/app/(dashboard)/dashboard/maintenance/failures/@panel/page.tsx` | 0 | — |
| `/dashboard/maintenance/failures/new` | — | `src/app/(dashboard)/dashboard/maintenance/failures/new/page.tsx` | 0 | FailureForm |
| `/dashboard/maintenance/failures` | — | `src/app/(dashboard)/dashboard/maintenance/failures/page.tsx` | 0 | — |
| `/dashboard/maintenance/machines/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/maintenance/machines/@panel/(.)[id]/edit/page.tsx` | 0 | MachineForm |
| `/dashboard/maintenance/machines/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/maintenance/machines/@panel/(.)new/page.tsx` | 0 | MachineForm |
| `/dashboard/maintenance/machines` | `@panel` | `src/app/(dashboard)/dashboard/maintenance/machines/@panel/page.tsx` | 0 | — |
| `/dashboard/maintenance/machines/[id]/edit` | — | `src/app/(dashboard)/dashboard/maintenance/machines/[id]/edit/page.tsx` | 0 | MachineForm |
| `/dashboard/maintenance/machines/new` | — | `src/app/(dashboard)/dashboard/maintenance/machines/new/page.tsx` | 0 | MachineForm |
| `/dashboard/maintenance/machines` | — | `src/app/(dashboard)/dashboard/maintenance/machines/page.tsx` | 0 | — |
| `/dashboard/maintenance` | — | `src/app/(dashboard)/dashboard/maintenance/page.tsx` | 0 | — |
| `/dashboard/maintenance/preventive/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/maintenance/preventive/@panel/(.)new/page.tsx` | 0 | PreventiveForm |
| `/dashboard/maintenance/preventive` | `@panel` | `src/app/(dashboard)/dashboard/maintenance/preventive/@panel/page.tsx` | 0 | — |
| `/dashboard/maintenance/preventive/new` | — | `src/app/(dashboard)/dashboard/maintenance/preventive/new/page.tsx` | 0 | PreventiveForm |
| `/dashboard/maintenance/preventive` | — | `src/app/(dashboard)/dashboard/maintenance/preventive/page.tsx` | 0 | — |
| `/dashboard/maintenance/recurrences` | — | `src/app/(dashboard)/dashboard/maintenance/recurrences/page.tsx` | 0 | — |
| `/dashboard/maintenance/repairs/new` | — | `src/app/(dashboard)/dashboard/maintenance/repairs/new/page.tsx` | 0 | RepairForm |
| `/dashboard/maintenance/repairs` | — | `src/app/(dashboard)/dashboard/maintenance/repairs/page.tsx` | 0 | — |
| `/dashboard/maintenance/spare-parts/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/maintenance/spare-parts/@panel/(.)[id]/edit/page.tsx` | 0 | SparePartForm |
| `/dashboard/maintenance/spare-parts/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/maintenance/spare-parts/@panel/(.)new/page.tsx` | 0 | SparePartForm |
| `/dashboard/maintenance/spare-parts` | `@panel` | `src/app/(dashboard)/dashboard/maintenance/spare-parts/@panel/page.tsx` | 0 | — |
| `/dashboard/maintenance/spare-parts/[id]/edit` | — | `src/app/(dashboard)/dashboard/maintenance/spare-parts/[id]/edit/page.tsx` | 0 | SparePartForm |
| `/dashboard/maintenance/spare-parts/new` | — | `src/app/(dashboard)/dashboard/maintenance/spare-parts/new/page.tsx` | 0 | SparePartForm |
| `/dashboard/maintenance/spare-parts` | — | `src/app/(dashboard)/dashboard/maintenance/spare-parts/page.tsx` | 0 | — |
| `/dashboard` | — | `src/app/(dashboard)/dashboard/page.tsx` | 0 | — |
| `/dashboard/petty-cash/boxes/new` | — | `src/app/(dashboard)/dashboard/petty-cash/boxes/new/page.tsx` | 1 | — |
| `/dashboard/petty-cash/boxes` | — | `src/app/(dashboard)/dashboard/petty-cash/boxes/page.tsx` | 0 | — |
| `/dashboard/petty-cash/categories/[id]/edit` | — | `src/app/(dashboard)/dashboard/petty-cash/categories/[id]/edit/page.tsx` | 0 | ExpenseCategoryForm |
| `/dashboard/petty-cash/categories` | — | `src/app/(dashboard)/dashboard/petty-cash/categories/page.tsx` | 0 | — |
| `/dashboard/petty-cash/expenses/new` | — | `src/app/(dashboard)/dashboard/petty-cash/expenses/new/page.tsx` | 1 | — |
| `/dashboard/petty-cash/income-adjustments/new` | — | `src/app/(dashboard)/dashboard/petty-cash/income-adjustments/new/page.tsx` | 1 | — |
| `/dashboard/petty-cash/monthly-summary` | — | `src/app/(dashboard)/dashboard/petty-cash/monthly-summary/page.tsx` | 1 | — |
| `/dashboard/petty-cash/movements` | — | `src/app/(dashboard)/dashboard/petty-cash/movements/page.tsx` | 2 | — |
| `/dashboard/petty-cash` | — | `src/app/(dashboard)/dashboard/petty-cash/page.tsx` | 0 | — |
| `/dashboard/production/bottlenecks` | — | `src/app/(dashboard)/dashboard/production/bottlenecks/page.tsx` | 0 | — |
| `/dashboard/production/campaigns/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/campaigns/@panel/(.)[id]/edit/page.tsx` | 0 | CampaignForm |
| `/dashboard/production/campaigns/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/campaigns/@panel/(.)new/page.tsx` | 0 | CampaignForm |
| `/dashboard/production/campaigns` | `@panel` | `src/app/(dashboard)/dashboard/production/campaigns/@panel/page.tsx` | 0 | — |
| `/dashboard/production/campaigns/[id]/edit` | — | `src/app/(dashboard)/dashboard/production/campaigns/[id]/edit/page.tsx` | 0 | CampaignForm |
| `/dashboard/production/campaigns/[id]` | — | `src/app/(dashboard)/dashboard/production/campaigns/[id]/page.tsx` | 0 | — |
| `/dashboard/production/campaigns/new` | — | `src/app/(dashboard)/dashboard/production/campaigns/new/page.tsx` | 0 | CampaignForm |
| `/dashboard/production/campaigns` | — | `src/app/(dashboard)/dashboard/production/campaigns/page.tsx` | 0 | — |
| `/dashboard/production` | — | `src/app/(dashboard)/dashboard/production/page.tsx` | 0 | — |
| `/dashboard/production/recipes/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/recipes/@panel/(.)new/page.tsx` | 0 | RecipeForm |
| `/dashboard/production/recipes` | `@panel` | `src/app/(dashboard)/dashboard/production/recipes/@panel/page.tsx` | 0 | — |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/@panel/(.)[detailId]/edit/page.tsx` | 0 | RecipeDetailForm |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/@panel/(.)new/page.tsx` | 0 | RecipeDetailForm |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details` | `@panel` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/@panel/page.tsx` | 0 | — |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit` | — | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit/page.tsx` | 0 | RecipeDetailForm |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details/new` | — | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/new/page.tsx` | 0 | RecipeDetailForm |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details` | — | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/page.tsx` | 0 | — |
| `/dashboard/production/recipes/[id]/versions/[versionId]/requirements` | — | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/requirements/page.tsx` | 1 | — |
| `/dashboard/production/recipes/[id]/versions/new` | — | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/new/page.tsx` | 0 | RecipeVersionForm |
| `/dashboard/production/recipes/[id]/versions` | — | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/page.tsx` | 0 | — |
| `/dashboard/production/recipes/new` | — | `src/app/(dashboard)/dashboard/production/recipes/new/page.tsx` | 0 | RecipeForm |
| `/dashboard/production/recipes` | — | `src/app/(dashboard)/dashboard/production/recipes/page.tsx` | 0 | — |
| `/dashboard/production/routes/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/routes/@panel/(.)[id]/edit/page.tsx` | 0 | RouteForm |
| `/dashboard/production/routes/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/routes/@panel/(.)new/page.tsx` | 0 | RouteForm |
| `/dashboard/production/routes` | `@panel` | `src/app/(dashboard)/dashboard/production/routes/@panel/page.tsx` | 0 | — |
| `/dashboard/production/routes/[id]/edit` | — | `src/app/(dashboard)/dashboard/production/routes/[id]/edit/page.tsx` | 0 | RouteForm |
| `/dashboard/production/routes/[id]/stages/[stageId]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/@panel/(.)[stageId]/edit/page.tsx` | 0 | StageForm |
| `/dashboard/production/routes/[id]/stages/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/@panel/(.)new/page.tsx` | 0 | StageForm |
| `/dashboard/production/routes/[id]/stages` | `@panel` | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/@panel/page.tsx` | 0 | — |
| `/dashboard/production/routes/[id]/stages/[stageId]/edit` | — | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/[stageId]/edit/page.tsx` | 0 | StageForm |
| `/dashboard/production/routes/[id]/stages/new` | — | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/new/page.tsx` | 0 | StageForm |
| `/dashboard/production/routes/[id]/stages` | — | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/page.tsx` | 0 | — |
| `/dashboard/production/routes/new` | — | `src/app/(dashboard)/dashboard/production/routes/new/page.tsx` | 0 | RouteForm |
| `/dashboard/production/routes` | — | `src/app/(dashboard)/dashboard/production/routes/page.tsx` | 0 | — |
| `/dashboard/production/work-orders/[id]` | — | `src/app/(dashboard)/dashboard/production/work-orders/[id]/page.tsx` | 2 | CloseMaterialsForm, MaterialMovementForm |
| `/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign` | — | `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign/page.tsx` | 1 | — |
| `/dashboard/production/work-orders/[id]/progress` | — | `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/page.tsx` | 2 | — |
| `/dashboard/production/work-orders/new` | — | `src/app/(dashboard)/dashboard/production/work-orders/new/page.tsx` | 0 | WorkOrderForm |
| `/dashboard/production/work-orders` | — | `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 2 | — |
| `/dashboard/reports/export-history` | — | `src/app/(dashboard)/dashboard/reports/export-history/page.tsx` | 0 | — |
| `/dashboard/reports/financial` | — | `src/app/(dashboard)/dashboard/reports/financial/page.tsx` | 0 | — |
| `/dashboard/reports/inventory` | — | `src/app/(dashboard)/dashboard/reports/inventory/page.tsx` | 0 | — |
| `/dashboard/reports/maintenance` | — | `src/app/(dashboard)/dashboard/reports/maintenance/page.tsx` | 0 | — |
| `/dashboard/reports` | — | `src/app/(dashboard)/dashboard/reports/page.tsx` | 0 | — |
| `/dashboard/reports/production` | — | `src/app/(dashboard)/dashboard/reports/production/page.tsx` | 0 | — |
| `/dashboard/reports/profitability` | — | `src/app/(dashboard)/dashboard/reports/profitability/page.tsx` | 0 | — |
| `/dashboard/reports/sales-collections` | — | `src/app/(dashboard)/dashboard/reports/sales-collections/page.tsx` | 0 | — |
| `/dashboard/reports/staff` | — | `src/app/(dashboard)/dashboard/reports/staff/page.tsx` | 0 | — |
| `/dashboard/reports/suppliers-purchases` | — | `src/app/(dashboard)/dashboard/reports/suppliers-purchases/page.tsx` | 0 | — |
| `/dashboard/staff/attendance/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/staff/attendance/@panel/(.)new/page.tsx` | 0 | AttendanceForm |
| `/dashboard/staff/attendance` | `@panel` | `src/app/(dashboard)/dashboard/staff/attendance/@panel/page.tsx` | 0 | — |
| `/dashboard/staff/attendance/new` | — | `src/app/(dashboard)/dashboard/staff/attendance/new/page.tsx` | 0 | AttendanceForm |
| `/dashboard/staff/attendance` | — | `src/app/(dashboard)/dashboard/staff/attendance/page.tsx` | 0 | — |
| `/dashboard/staff/operators/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/staff/operators/@panel/(.)[id]/edit/page.tsx` | 0 | OperatorForm |
| `/dashboard/staff/operators/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/staff/operators/@panel/(.)new/page.tsx` | 0 | OperatorForm |
| `/dashboard/staff/operators` | `@panel` | `src/app/(dashboard)/dashboard/staff/operators/@panel/page.tsx` | 0 | — |
| `/dashboard/staff/operators/[id]/edit` | — | `src/app/(dashboard)/dashboard/staff/operators/[id]/edit/page.tsx` | 0 | OperatorForm |
| `/dashboard/staff/operators/new` | — | `src/app/(dashboard)/dashboard/staff/operators/new/page.tsx` | 0 | OperatorForm |
| `/dashboard/staff/operators` | — | `src/app/(dashboard)/dashboard/staff/operators/page.tsx` | 0 | — |
| `/dashboard/staff` | — | `src/app/(dashboard)/dashboard/staff/page.tsx` | 0 | — |
| `/dashboard/staff/payment-history/new` | — | `src/app/(dashboard)/dashboard/staff/payment-history/new/page.tsx` | 1 | — |
| `/dashboard/staff/payment-history` | — | `src/app/(dashboard)/dashboard/staff/payment-history/page.tsx` | 0 | — |
| `/dashboard/staff/payrolls/new` | — | `src/app/(dashboard)/dashboard/staff/payrolls/new/page.tsx` | 1 | — |
| `/dashboard/staff/payrolls` | — | `src/app/(dashboard)/dashboard/staff/payrolls/page.tsx` | 1 | — |
| `/dashboard/staff/tasks/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/staff/tasks/@panel/(.)new/page.tsx` | 0 | TaskForm |
| `/dashboard/staff/tasks` | `@panel` | `src/app/(dashboard)/dashboard/staff/tasks/@panel/page.tsx` | 0 | — |
| `/dashboard/staff/tasks/new` | — | `src/app/(dashboard)/dashboard/staff/tasks/new/page.tsx` | 0 | TaskForm |
| `/dashboard/staff/tasks` | — | `src/app/(dashboard)/dashboard/staff/tasks/page.tsx` | 0 | — |
| `/dashboard/users/[id]/edit` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/users/@panel/(.)[id]/edit/page.tsx` | 0 | UserForm |
| `/dashboard/users/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/users/@panel/(.)new/page.tsx` | 0 | UserForm |
| `/dashboard/users` | `@panel` | `src/app/(dashboard)/dashboard/users/@panel/page.tsx` | 0 | — |
| `/dashboard/users/[id]/edit` | — | `src/app/(dashboard)/dashboard/users/[id]/edit/page.tsx` | 0 | UserForm |
| `/dashboard/users/new` | — | `src/app/(dashboard)/dashboard/users/new/page.tsx` | 0 | UserForm |
| `/dashboard/users` | — | `src/app/(dashboard)/dashboard/users/page.tsx` | 0 | — |
| `/dashboard/waste-scrap` | — | `src/app/(dashboard)/dashboard/waste-scrap/page.tsx` | 0 | — |
| `/dashboard/waste-scrap/reusable-scraps/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/@panel/(.)new/page.tsx` | 0 | ReusableScrapForm |
| `/dashboard/waste-scrap/reusable-scraps` | `@panel` | `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/@panel/page.tsx` | 0 | — |
| `/dashboard/waste-scrap/reusable-scraps/new` | — | `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/new/page.tsx` | 0 | ReusableScrapForm |
| `/dashboard/waste-scrap/reusable-scraps` | — | `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/page.tsx` | 0 | — |
| `/dashboard/waste-scrap/scrap-sales/new` | — | `src/app/(dashboard)/dashboard/waste-scrap/scrap-sales/new/page.tsx` | 1 | — |
| `/dashboard/waste-scrap/scraps/new` | `@panel`, intercepta | `src/app/(dashboard)/dashboard/waste-scrap/scraps/@panel/(.)new/page.tsx` | 0 | ScrapForm |
| `/dashboard/waste-scrap/scraps` | `@panel` | `src/app/(dashboard)/dashboard/waste-scrap/scraps/@panel/page.tsx` | 0 | — |
| `/dashboard/waste-scrap/scraps/new` | — | `src/app/(dashboard)/dashboard/waste-scrap/scraps/new/page.tsx` | 0 | ScrapForm |
| `/dashboard/waste-scrap/scraps` | — | `src/app/(dashboard)/dashboard/waste-scrap/scraps/page.tsx` | 0 | — |
| `/` | — | `src/app/page.tsx` | 0 | — |

## Declaraciones de formularios

| Fuente | Línea | Acción |
| --- | --- | --- |
| `src/app/(dashboard)/dashboard/commercial/orders/page.tsx` | 235 | `{cancelOrderAction}` |
| `src/app/(dashboard)/dashboard/commercial/quotes/[id]/page.tsx` | 79 | `{annulQuoteAction}` |
| `src/app/(dashboard)/dashboard/commercial/quotes/page.tsx` | 203 | `{annulQuoteAction}` |
| `src/app/(dashboard)/dashboard/commercial/receipts/page.tsx` | 136 | `{annulReceiptAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/boxes/new/page.tsx` | 46 | `{createPettyCashBoxAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/expenses/new/page.tsx` | 90 | `{createPettyCashExpenseAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/income-adjustments/new/page.tsx` | 115 | `{createPettyCashIncomeAdjustmentAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/monthly-summary/page.tsx` | 253 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/petty-cash/movements/page.tsx` | 177 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/petty-cash/movements/page.tsx` | 335 | `{annulPettyCashMovementAction}` |
| `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/requirements/page.tsx` | 165 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/page.tsx` | 263 | `{deliverWorkOrderMaterialsAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/page.tsx` | 557 | `{reopenWorkOrderMaterialsAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign/page.tsx` | 102 | `{reassignWorkOrderProgressAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/page.tsx` | 208 | `{generateWorkOrderProgressAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/page.tsx` | 231 | `{updateWorkOrderProgressAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 375 | `{annulWorkOrderAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 394 | `{finishWorkOrderAction}` |
| `src/app/(dashboard)/dashboard/staff/payment-history/new/page.tsx` | 91 | `{registerOperatorPaymentAction}` |
| `src/app/(dashboard)/dashboard/staff/payrolls/new/page.tsx` | 98 | `{generatePayrollAction}` |
| `src/app/(dashboard)/dashboard/staff/payrolls/page.tsx` | 260 | `{cancelPayrollAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/scrap-sales/new/page.tsx` | 82 | `{createScrapSaleAction}` |
| `src/components/commercial/payment-form.tsx` | 31 | `{createPaymentAction}` |
| `src/components/commercial/quote-form.tsx` | 66 | `{createQuoteAction}` |
| `src/components/commercial/receipt-form.tsx` | 54 | `{createReceiptAction}` |
| `src/components/forms/action-form.tsx` | 48 | `{action}` |
| `src/components/forms/filter-bar.tsx` | 39 | `{action}` |
| `src/components/table/row-actions.tsx` | 44 | `{action}` |
| `src/modules/auth/components/login-form.tsx` | 162 | `{formAction}` |
| `src/modules/auth/components/logout-button.tsx` | 8 | `{async () => { "use server"; await signOut({ redirectTo: "/login", }); }}` |
| `src/modules/gallery/dialog-demo.tsx` | 72 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/modules/inventory/movements/inventory-output-form.tsx` | 62 | `{formAction}` |
| `src/modules/production/work-orders/close-materials-form.tsx` | 60 | `{closeWorkOrderMaterialsAction}` |
| `src/modules/production/work-orders/components/work-order-form.tsx` | 295 | `{createWorkOrderAction}` |
| `src/modules/production/work-orders/material-movement-form.tsx` | 52 | `{ isReturn ? returnWorkOrderMaterialAction : deliverAdditionalMaterialAction }` |

## Entradas de servidor

| Fuente | Funciones exportadas |
| --- | --- |
| `src/modules/auth/actions/login.action.ts` | loginAction |
| `src/modules/commercial/clients/actions.ts` | createClientAction, updateClientAction, toggleClientStatusAction |
| `src/modules/commercial/orders/actions.ts` | createOrderAction, updateOrderAction, cancelOrderAction |
| `src/modules/commercial/payments/actions.ts` | createPaymentAction |
| `src/modules/commercial/products/actions.ts` | createProductAction, updateProductAction, toggleProductStatusAction, createProductCategoryAction, updateProductCategoryAction, toggleProductCategoryStatusAction |
| `src/modules/commercial/quotes/actions.ts` | createQuoteAction, annulQuoteAction |
| `src/modules/commercial/receipts/actions.ts` | createReceiptAction, annulReceiptAction |
| `src/modules/costs/costings/actions.ts` | createCostingFromWorkOrderAction, updateLaborCostAction, recalculateCostingAction |
| `src/modules/costs/indirect-costs/actions.ts` | createIndirectCostAction, annulIndirectCostAction |
| `src/modules/costs/margins/actions.ts` | createMarginAction |
| `src/modules/costs/profitability/actions.ts` | createProfitabilityAction |
| `src/modules/inventory/alerts/actions.ts` | attendStockAlertAction |
| `src/modules/inventory/material-categories/actions.ts` | createMaterialCategoryAction, updateMaterialCategoryAction, toggleMaterialCategoryStatusAction |
| `src/modules/inventory/materials/actions.ts` | createMaterialAction, updateMaterialAction, toggleMaterialStatusAction |
| `src/modules/inventory/movements/actions.ts` | createInventoryOutputAction |
| `src/modules/inventory/purchases/actions.ts` | createPurchaseAction, annulPurchaseAction |
| `src/modules/inventory/supplier-materials/actions.ts` | createSupplierMaterialAction, updateSupplierMaterialAction, toggleSupplierMaterialStatusAction |
| `src/modules/inventory/supplier-payments/actions.ts` | createSupplierPaymentAction |
| `src/modules/inventory/supplier-types/actions.ts` | createSupplierTypeAction, updateSupplierTypeAction, toggleSupplierTypeStatusAction |
| `src/modules/inventory/suppliers/actions.ts` | createSupplierAction, updateSupplierAction, toggleSupplierStatusAction, createQuickSupplierAction |
| `src/modules/maintenance/failures/actions.ts` | createFailureAction, updateFailureStatusAction |
| `src/modules/maintenance/machines/actions.ts` | createMachineAction, updateMachineAction, toggleMachineStatusAction |
| `src/modules/maintenance/preventive/actions.ts` | createPreventiveMaintenanceAction, updatePreventiveMaintenanceStatusAction |
| `src/modules/maintenance/repairs/actions.ts` | createRepairAction, updateRepairStatusAction |
| `src/modules/maintenance/spare-parts/actions.ts` | createSparePartAction, updateSparePartAction, toggleSparePartStatusAction |
| `src/modules/petty-cash/boxes/actions.ts` | createPettyCashBoxAction |
| `src/modules/petty-cash/categories/actions.ts` | createExpenseCategoryAction, updateExpenseCategoryAction, toggleExpenseCategoryStatusAction |
| `src/modules/petty-cash/expenses/actions.ts` | createPettyCashExpenseAction |
| `src/modules/petty-cash/income-adjustments/actions.ts` | createPettyCashIncomeAdjustmentAction |
| `src/modules/petty-cash/movements/actions.ts` | annulPettyCashMovementAction |
| `src/modules/production/campaigns/actions.ts` | createProductionCampaignAction, addCampaignDetailAction, updateProductionCampaignAction, changeProductionCampaignStatusAction |
| `src/modules/production/recipe-details/actions.ts` | createRecipeDetailAction, updateRecipeDetailAction, deleteRecipeDetailAction |
| `src/modules/production/recipe-versions/actions.ts` | createRecipeVersionAction, setCurrentRecipeVersionAction, voidRecipeVersionAction |
| `src/modules/production/recipes/actions.ts` | createTechnicalRecipeAction, toggleTechnicalRecipeStatusAction |
| `src/modules/production/routes/actions.ts` | createFabricationRouteAction, updateFabricationRouteAction, toggleFabricationRouteStatusAction |
| `src/modules/production/stages/actions.ts` | createRouteStageAction, updateRouteStageAction, toggleRouteStageStatusAction |
| `src/modules/production/work-order-progress/actions.ts` | generateWorkOrderProgressAction, updateWorkOrderProgressAction, reassignWorkOrderProgressAction |
| `src/modules/production/work-orders/actions.ts` | createWorkOrderAction, deliverWorkOrderMaterialsAction, deliverAdditionalMaterialAction, returnWorkOrderMaterialAction, closeWorkOrderMaterialsAction, reopenWorkOrderMaterialsAction, annulWorkOrderAction, finishWorkOrderAction |
| `src/modules/staff/attendance/actions.ts` | createAttendanceAction |
| `src/modules/staff/operators/actions.ts` | createOperatorAction, updateOperatorAction, updateOperatorStatusAction |
| `src/modules/staff/payment-history/actions.ts` | registerOperatorPaymentAction |
| `src/modules/staff/payrolls/actions.ts` | generatePayrollAction, cancelPayrollAction |
| `src/modules/staff/tasks/actions.ts` | createOperatorTaskAction, cancelOperatorTaskAction |
| `src/modules/users/actions.ts` | createUserAction, updateUserAction, updateUserStatusAction, resetUserPasswordAction |
| `src/modules/waste-scrap/reusable-scraps/actions.ts` | createReusableScrapAction |
| `src/modules/waste-scrap/reusable-scraps/status-actions.ts` | updateReusableScrapStatusAction |
| `src/modules/waste-scrap/scrap-sales/actions.ts` | createScrapSaleAction |
| `src/modules/waste-scrap/scraps/actions.ts` | createScrapAction |

