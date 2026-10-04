# Inventario estructural para la refactorización

Generado con `npm run refactor:inventory`. No editar las tablas a mano.

Este inventario analiza el árbol sintáctico de `src`, excluyendo el cliente generado. Cuenta declaraciones JSX de formularios, incluidos filtros y acciones por fila; no equivale al número de pantallas de alta/edición. Los componentes importados son candidatos por nombre y requieren clasificación funcional en el piloto. El seguimiento manual se mantiene en `SEGUIMIENTO.md`.

| Medida | Cantidad |
| --- | --- |
| Archivos fuente analizados | 451 |
| Páginas | 127 |
| Declaraciones JSX de formulario | 136 |
| Archivos con directiva use server | 48 |
| Funciones exportadas en esos archivos | 114 |

## Páginas por área

| Área | Páginas |
| --- | --- |
| access-denied | 1 |
| audit | 1 |
| auth | 1 |
| commercial | 17 |
| costs | 4 |
| inicio | 2 |
| inventory | 20 |
| maintenance | 14 |
| petty-cash | 9 |
| production | 26 |
| reports | 10 |
| staff | 12 |
| users | 4 |
| waste-scrap | 6 |

## Rutas y formularios candidatos

| Ruta | Fuente | Formularios inline | Componentes candidatos |
| --- | --- | --- | --- |
| `/login` | `src/app/(auth)/login/page.tsx` | 0 | LoginForm |
| `/dashboard/access-denied` | `src/app/(dashboard)/dashboard/access-denied/page.tsx` | 0 | — |
| `/dashboard/audit` | `src/app/(dashboard)/dashboard/audit/page.tsx` | 1 | — |
| `/dashboard/commercial/clients/[id]/edit` | `src/app/(dashboard)/dashboard/commercial/clients/[id]/edit/page.tsx` | 0 | ClientForm |
| `/dashboard/commercial/clients/new` | `src/app/(dashboard)/dashboard/commercial/clients/new/page.tsx` | 0 | ClientForm |
| `/dashboard/commercial/clients` | `src/app/(dashboard)/dashboard/commercial/clients/page.tsx` | 1 | — |
| `/dashboard/commercial/orders/[id]/edit` | `src/app/(dashboard)/dashboard/commercial/orders/[id]/edit/page.tsx` | 0 | OrderForm |
| `/dashboard/commercial/orders/[id]` | `src/app/(dashboard)/dashboard/commercial/orders/[id]/page.tsx` | 0 | — |
| `/dashboard/commercial/orders/new` | `src/app/(dashboard)/dashboard/commercial/orders/new/page.tsx` | 0 | OrderForm |
| `/dashboard/commercial/orders` | `src/app/(dashboard)/dashboard/commercial/orders/page.tsx` | 2 | — |
| `/dashboard/commercial` | `src/app/(dashboard)/dashboard/commercial/page.tsx` | 0 | — |
| `/dashboard/commercial/payments` | `src/app/(dashboard)/dashboard/commercial/payments/page.tsx` | 1 | — |
| `/dashboard/commercial/product-categories` | `src/app/(dashboard)/dashboard/commercial/product-categories/page.tsx` | 0 | ProductCategoryManager |
| `/dashboard/commercial/products/[id]/edit` | `src/app/(dashboard)/dashboard/commercial/products/[id]/edit/page.tsx` | 0 | ProductForm |
| `/dashboard/commercial/products/new` | `src/app/(dashboard)/dashboard/commercial/products/new/page.tsx` | 0 | ProductForm |
| `/dashboard/commercial/products` | `src/app/(dashboard)/dashboard/commercial/products/page.tsx` | 1 | — |
| `/dashboard/commercial/quotes/[id]` | `src/app/(dashboard)/dashboard/commercial/quotes/[id]/page.tsx` | 1 | ReceiptForm, PaymentForm |
| `/dashboard/commercial/quotes/new` | `src/app/(dashboard)/dashboard/commercial/quotes/new/page.tsx` | 0 | QuoteForm |
| `/dashboard/commercial/quotes` | `src/app/(dashboard)/dashboard/commercial/quotes/page.tsx` | 2 | — |
| `/dashboard/commercial/receipts` | `src/app/(dashboard)/dashboard/commercial/receipts/page.tsx` | 2 | — |
| `/dashboard/costs/costings/[id]` | `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 6 | — |
| `/dashboard/costs/costings` | `src/app/(dashboard)/dashboard/costs/costings/page.tsx` | 1 | — |
| `/dashboard/costs` | `src/app/(dashboard)/dashboard/costs/page.tsx` | 0 | — |
| `/dashboard/costs/work-orders` | `src/app/(dashboard)/dashboard/costs/work-orders/page.tsx` | 1 | — |
| `/dashboard/inventory/alerts` | `src/app/(dashboard)/dashboard/inventory/alerts/page.tsx` | 1 | — |
| `/dashboard/inventory/entries` | `src/app/(dashboard)/dashboard/inventory/entries/page.tsx` | 1 | — |
| `/dashboard/inventory/material-categories` | `src/app/(dashboard)/dashboard/inventory/material-categories/page.tsx` | 0 | InventoryCatalogManager |
| `/dashboard/inventory/materials/[id]/edit` | `src/app/(dashboard)/dashboard/inventory/materials/[id]/edit/page.tsx` | 0 | MaterialForm |
| `/dashboard/inventory/materials/new` | `src/app/(dashboard)/dashboard/inventory/materials/new/page.tsx` | 0 | MaterialForm |
| `/dashboard/inventory/materials` | `src/app/(dashboard)/dashboard/inventory/materials/page.tsx` | 1 | — |
| `/dashboard/inventory/outputs/new` | `src/app/(dashboard)/dashboard/inventory/outputs/new/page.tsx` | 0 | InventoryOutputForm |
| `/dashboard/inventory/outputs` | `src/app/(dashboard)/dashboard/inventory/outputs/page.tsx` | 1 | — |
| `/dashboard/inventory` | `src/app/(dashboard)/dashboard/inventory/page.tsx` | 0 | — |
| `/dashboard/inventory/purchases/[id]` | `src/app/(dashboard)/dashboard/inventory/purchases/[id]/page.tsx` | 1 | SupplierPaymentForm |
| `/dashboard/inventory/purchases/new` | `src/app/(dashboard)/dashboard/inventory/purchases/new/page.tsx` | 0 | PurchaseForm |
| `/dashboard/inventory/purchases` | `src/app/(dashboard)/dashboard/inventory/purchases/page.tsx` | 2 | — |
| `/dashboard/inventory/supplier-materials/[id]/edit` | `src/app/(dashboard)/dashboard/inventory/supplier-materials/[id]/edit/page.tsx` | 0 | SupplierMaterialForm |
| `/dashboard/inventory/supplier-materials/new` | `src/app/(dashboard)/dashboard/inventory/supplier-materials/new/page.tsx` | 0 | SupplierMaterialForm |
| `/dashboard/inventory/supplier-materials` | `src/app/(dashboard)/dashboard/inventory/supplier-materials/page.tsx` | 1 | — |
| `/dashboard/inventory/supplier-payments` | `src/app/(dashboard)/dashboard/inventory/supplier-payments/page.tsx` | 1 | — |
| `/dashboard/inventory/supplier-types` | `src/app/(dashboard)/dashboard/inventory/supplier-types/page.tsx` | 0 | InventoryCatalogManager |
| `/dashboard/inventory/suppliers/[id]/edit` | `src/app/(dashboard)/dashboard/inventory/suppliers/[id]/edit/page.tsx` | 0 | SupplierForm |
| `/dashboard/inventory/suppliers/new` | `src/app/(dashboard)/dashboard/inventory/suppliers/new/page.tsx` | 0 | SupplierForm |
| `/dashboard/inventory/suppliers` | `src/app/(dashboard)/dashboard/inventory/suppliers/page.tsx` | 1 | — |
| `/dashboard/maintenance/failures/new` | `src/app/(dashboard)/dashboard/maintenance/failures/new/page.tsx` | 1 | — |
| `/dashboard/maintenance/failures` | `src/app/(dashboard)/dashboard/maintenance/failures/page.tsx` | 1 | — |
| `/dashboard/maintenance/machines/[id]/edit` | `src/app/(dashboard)/dashboard/maintenance/machines/[id]/edit/page.tsx` | 0 | MachineForm |
| `/dashboard/maintenance/machines/new` | `src/app/(dashboard)/dashboard/maintenance/machines/new/page.tsx` | 0 | MachineForm |
| `/dashboard/maintenance/machines` | `src/app/(dashboard)/dashboard/maintenance/machines/page.tsx` | 1 | — |
| `/dashboard/maintenance` | `src/app/(dashboard)/dashboard/maintenance/page.tsx` | 0 | — |
| `/dashboard/maintenance/preventive/new` | `src/app/(dashboard)/dashboard/maintenance/preventive/new/page.tsx` | 1 | — |
| `/dashboard/maintenance/preventive` | `src/app/(dashboard)/dashboard/maintenance/preventive/page.tsx` | 2 | — |
| `/dashboard/maintenance/recurrences` | `src/app/(dashboard)/dashboard/maintenance/recurrences/page.tsx` | 0 | — |
| `/dashboard/maintenance/repairs/new` | `src/app/(dashboard)/dashboard/maintenance/repairs/new/page.tsx` | 1 | — |
| `/dashboard/maintenance/repairs` | `src/app/(dashboard)/dashboard/maintenance/repairs/page.tsx` | 2 | — |
| `/dashboard/maintenance/spare-parts/[id]/edit` | `src/app/(dashboard)/dashboard/maintenance/spare-parts/[id]/edit/page.tsx` | 0 | SparePartForm |
| `/dashboard/maintenance/spare-parts/new` | `src/app/(dashboard)/dashboard/maintenance/spare-parts/new/page.tsx` | 0 | SparePartForm |
| `/dashboard/maintenance/spare-parts` | `src/app/(dashboard)/dashboard/maintenance/spare-parts/page.tsx` | 1 | — |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | 0 | — |
| `/dashboard/petty-cash/boxes/new` | `src/app/(dashboard)/dashboard/petty-cash/boxes/new/page.tsx` | 1 | — |
| `/dashboard/petty-cash/boxes` | `src/app/(dashboard)/dashboard/petty-cash/boxes/page.tsx` | 0 | — |
| `/dashboard/petty-cash/categories/[id]/edit` | `src/app/(dashboard)/dashboard/petty-cash/categories/[id]/edit/page.tsx` | 0 | ExpenseCategoryForm |
| `/dashboard/petty-cash/categories` | `src/app/(dashboard)/dashboard/petty-cash/categories/page.tsx` | 1 | ExpenseCategoryForm |
| `/dashboard/petty-cash/expenses/new` | `src/app/(dashboard)/dashboard/petty-cash/expenses/new/page.tsx` | 1 | — |
| `/dashboard/petty-cash/income-adjustments/new` | `src/app/(dashboard)/dashboard/petty-cash/income-adjustments/new/page.tsx` | 1 | — |
| `/dashboard/petty-cash/monthly-summary` | `src/app/(dashboard)/dashboard/petty-cash/monthly-summary/page.tsx` | 1 | — |
| `/dashboard/petty-cash/movements` | `src/app/(dashboard)/dashboard/petty-cash/movements/page.tsx` | 2 | — |
| `/dashboard/petty-cash` | `src/app/(dashboard)/dashboard/petty-cash/page.tsx` | 0 | — |
| `/dashboard/production/bottlenecks` | `src/app/(dashboard)/dashboard/production/bottlenecks/page.tsx` | 1 | — |
| `/dashboard/production/campaigns/[id]/details/new` | `src/app/(dashboard)/dashboard/production/campaigns/[id]/details/new/page.tsx` | 1 | — |
| `/dashboard/production/campaigns/[id]/edit` | `src/app/(dashboard)/dashboard/production/campaigns/[id]/edit/page.tsx` | 1 | — |
| `/dashboard/production/campaigns/[id]` | `src/app/(dashboard)/dashboard/production/campaigns/[id]/page.tsx` | 0 | — |
| `/dashboard/production/campaigns/new` | `src/app/(dashboard)/dashboard/production/campaigns/new/page.tsx` | 1 | — |
| `/dashboard/production/campaigns` | `src/app/(dashboard)/dashboard/production/campaigns/page.tsx` | 4 | — |
| `/dashboard/production` | `src/app/(dashboard)/dashboard/production/page.tsx` | 0 | — |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit/page.tsx` | 0 | RecipeDetailForm |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details/new` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/new/page.tsx` | 0 | RecipeDetailForm |
| `/dashboard/production/recipes/[id]/versions/[versionId]/details` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/page.tsx` | 1 | — |
| `/dashboard/production/recipes/[id]/versions/[versionId]/requirements` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/requirements/page.tsx` | 1 | — |
| `/dashboard/production/recipes/[id]/versions/new` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/new/page.tsx` | 0 | RecipeVersionForm |
| `/dashboard/production/recipes/[id]/versions` | `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/page.tsx` | 2 | — |
| `/dashboard/production/recipes/new` | `src/app/(dashboard)/dashboard/production/recipes/new/page.tsx` | 1 | — |
| `/dashboard/production/recipes` | `src/app/(dashboard)/dashboard/production/recipes/page.tsx` | 2 | — |
| `/dashboard/production/routes/[id]/edit` | `src/app/(dashboard)/dashboard/production/routes/[id]/edit/page.tsx` | 1 | — |
| `/dashboard/production/routes/[id]/stages/[stageId]/edit` | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/[stageId]/edit/page.tsx` | 0 | StageForm |
| `/dashboard/production/routes/[id]/stages/new` | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/new/page.tsx` | 0 | StageForm |
| `/dashboard/production/routes/[id]/stages` | `src/app/(dashboard)/dashboard/production/routes/[id]/stages/page.tsx` | 2 | — |
| `/dashboard/production/routes/new` | `src/app/(dashboard)/dashboard/production/routes/new/page.tsx` | 1 | — |
| `/dashboard/production/routes` | `src/app/(dashboard)/dashboard/production/routes/page.tsx` | 2 | — |
| `/dashboard/production/work-orders/[id]` | `src/app/(dashboard)/dashboard/production/work-orders/[id]/page.tsx` | 2 | CloseMaterialsForm, MaterialMovementForm |
| `/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign` | `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign/page.tsx` | 1 | — |
| `/dashboard/production/work-orders/[id]/progress` | `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/page.tsx` | 2 | — |
| `/dashboard/production/work-orders/new` | `src/app/(dashboard)/dashboard/production/work-orders/new/page.tsx` | 0 | WorkOrderForm |
| `/dashboard/production/work-orders` | `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 3 | — |
| `/dashboard/reports/export-history` | `src/app/(dashboard)/dashboard/reports/export-history/page.tsx` | 1 | — |
| `/dashboard/reports/financial` | `src/app/(dashboard)/dashboard/reports/financial/page.tsx` | 1 | — |
| `/dashboard/reports/inventory` | `src/app/(dashboard)/dashboard/reports/inventory/page.tsx` | 1 | — |
| `/dashboard/reports/maintenance` | `src/app/(dashboard)/dashboard/reports/maintenance/page.tsx` | 1 | — |
| `/dashboard/reports` | `src/app/(dashboard)/dashboard/reports/page.tsx` | 0 | — |
| `/dashboard/reports/production` | `src/app/(dashboard)/dashboard/reports/production/page.tsx` | 1 | — |
| `/dashboard/reports/profitability` | `src/app/(dashboard)/dashboard/reports/profitability/page.tsx` | 1 | — |
| `/dashboard/reports/sales-collections` | `src/app/(dashboard)/dashboard/reports/sales-collections/page.tsx` | 1 | — |
| `/dashboard/reports/staff` | `src/app/(dashboard)/dashboard/reports/staff/page.tsx` | 1 | — |
| `/dashboard/reports/suppliers-purchases` | `src/app/(dashboard)/dashboard/reports/suppliers-purchases/page.tsx` | 1 | — |
| `/dashboard/staff/attendance/new` | `src/app/(dashboard)/dashboard/staff/attendance/new/page.tsx` | 1 | — |
| `/dashboard/staff/attendance` | `src/app/(dashboard)/dashboard/staff/attendance/page.tsx` | 1 | — |
| `/dashboard/staff/operators/[id]/edit` | `src/app/(dashboard)/dashboard/staff/operators/[id]/edit/page.tsx` | 0 | OperatorForm |
| `/dashboard/staff/operators/new` | `src/app/(dashboard)/dashboard/staff/operators/new/page.tsx` | 0 | OperatorForm |
| `/dashboard/staff/operators` | `src/app/(dashboard)/dashboard/staff/operators/page.tsx` | 1 | — |
| `/dashboard/staff` | `src/app/(dashboard)/dashboard/staff/page.tsx` | 0 | — |
| `/dashboard/staff/payment-history/new` | `src/app/(dashboard)/dashboard/staff/payment-history/new/page.tsx` | 1 | — |
| `/dashboard/staff/payment-history` | `src/app/(dashboard)/dashboard/staff/payment-history/page.tsx` | 0 | — |
| `/dashboard/staff/payrolls/new` | `src/app/(dashboard)/dashboard/staff/payrolls/new/page.tsx` | 1 | — |
| `/dashboard/staff/payrolls` | `src/app/(dashboard)/dashboard/staff/payrolls/page.tsx` | 2 | — |
| `/dashboard/staff/tasks/new` | `src/app/(dashboard)/dashboard/staff/tasks/new/page.tsx` | 1 | — |
| `/dashboard/staff/tasks` | `src/app/(dashboard)/dashboard/staff/tasks/page.tsx` | 1 | — |
| `/dashboard/users/[id]/edit` | `src/app/(dashboard)/dashboard/users/[id]/edit/page.tsx` | 0 | UserForm |
| `/dashboard/users/[id]/reset-password` | `src/app/(dashboard)/dashboard/users/[id]/reset-password/page.tsx` | 0 | ResetPasswordForm |
| `/dashboard/users/new` | `src/app/(dashboard)/dashboard/users/new/page.tsx` | 0 | UserForm |
| `/dashboard/users` | `src/app/(dashboard)/dashboard/users/page.tsx` | 3 | — |
| `/dashboard/waste-scrap` | `src/app/(dashboard)/dashboard/waste-scrap/page.tsx` | 0 | — |
| `/dashboard/waste-scrap/reusable-scraps/new` | `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/new/page.tsx` | 1 | — |
| `/dashboard/waste-scrap/reusable-scraps` | `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/page.tsx` | 3 | — |
| `/dashboard/waste-scrap/scrap-sales/new` | `src/app/(dashboard)/dashboard/waste-scrap/scrap-sales/new/page.tsx` | 1 | — |
| `/dashboard/waste-scrap/scraps/new` | `src/app/(dashboard)/dashboard/waste-scrap/scraps/new/page.tsx` | 1 | — |
| `/dashboard/waste-scrap/scraps` | `src/app/(dashboard)/dashboard/waste-scrap/scraps/page.tsx` | 1 | — |
| `/` | `src/app/page.tsx` | 0 | — |

## Declaraciones de formularios

| Fuente | Línea | Acción |
| --- | --- | --- |
| `src/app/(dashboard)/dashboard/audit/page.tsx` | 104 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/commercial/clients/page.tsx` | 106 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/commercial/orders/page.tsx` | 78 | `"/dashboard/commercial/orders"` |
| `src/app/(dashboard)/dashboard/commercial/orders/page.tsx` | 249 | `{cancelOrderAction}` |
| `src/app/(dashboard)/dashboard/commercial/payments/page.tsx` | 66 | `"/dashboard/commercial/payments"` |
| `src/app/(dashboard)/dashboard/commercial/products/page.tsx` | 99 | `"/dashboard/commercial/products"` |
| `src/app/(dashboard)/dashboard/commercial/quotes/[id]/page.tsx` | 79 | `{annulQuoteAction}` |
| `src/app/(dashboard)/dashboard/commercial/quotes/page.tsx` | 72 | `"/dashboard/commercial/quotes"` |
| `src/app/(dashboard)/dashboard/commercial/quotes/page.tsx` | 218 | `{annulQuoteAction}` |
| `src/app/(dashboard)/dashboard/commercial/receipts/page.tsx` | 56 | `"/dashboard/commercial/receipts"` |
| `src/app/(dashboard)/dashboard/commercial/receipts/page.tsx` | 156 | `{annulReceiptAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 322 | `{updateLaborCostAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 347 | `{recalculateCostingAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 532 | `{createIndirectCostAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 684 | `{annulIndirectCostAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 752 | `{createMarginAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/[id]/page.tsx` | 919 | `{createProfitabilityAction}` |
| `src/app/(dashboard)/dashboard/costs/costings/page.tsx` | 239 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/costs/work-orders/page.tsx` | 311 | `{createCostingFromWorkOrderAction}` |
| `src/app/(dashboard)/dashboard/inventory/alerts/page.tsx` | 208 | `{attendStockAlertAction}` |
| `src/app/(dashboard)/dashboard/inventory/entries/page.tsx` | 66 | `"/dashboard/inventory/entries"` |
| `src/app/(dashboard)/dashboard/inventory/materials/page.tsx` | 113 | `"/dashboard/inventory/materials"` |
| `src/app/(dashboard)/dashboard/inventory/outputs/page.tsx` | 72 | `"/dashboard/inventory/outputs"` |
| `src/app/(dashboard)/dashboard/inventory/purchases/[id]/page.tsx` | 83 | `{annulPurchaseAction}` |
| `src/app/(dashboard)/dashboard/inventory/purchases/page.tsx` | 78 | `"/dashboard/inventory/purchases"` |
| `src/app/(dashboard)/dashboard/inventory/purchases/page.tsx` | 225 | `{annulPurchaseAction}` |
| `src/app/(dashboard)/dashboard/inventory/supplier-materials/page.tsx` | 90 | `"/dashboard/inventory/supplier-materials"` |
| `src/app/(dashboard)/dashboard/inventory/supplier-payments/page.tsx` | 67 | `"/dashboard/inventory/supplier-payments"` |
| `src/app/(dashboard)/dashboard/inventory/suppliers/page.tsx` | 92 | `"/dashboard/inventory/suppliers"` |
| `src/app/(dashboard)/dashboard/maintenance/failures/new/page.tsx` | 89 | `{createFailureAction}` |
| `src/app/(dashboard)/dashboard/maintenance/failures/page.tsx` | 213 | `{updateFailureStatusAction}` |
| `src/app/(dashboard)/dashboard/maintenance/machines/page.tsx` | 142 | `"/dashboard/maintenance/machines"` |
| `src/app/(dashboard)/dashboard/maintenance/preventive/new/page.tsx` | 91 | `{createPreventiveMaintenanceAction}` |
| `src/app/(dashboard)/dashboard/maintenance/preventive/page.tsx` | 155 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/maintenance/preventive/page.tsx` | 322 | `{updatePreventiveMaintenanceStatusAction}` |
| `src/app/(dashboard)/dashboard/maintenance/repairs/new/page.tsx` | 97 | `{createRepairAction}` |
| `src/app/(dashboard)/dashboard/maintenance/repairs/page.tsx` | 142 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/maintenance/repairs/page.tsx` | 312 | `{updateRepairStatusAction}` |
| `src/app/(dashboard)/dashboard/maintenance/spare-parts/page.tsx` | 103 | `"/dashboard/maintenance/spare-parts"` |
| `src/app/(dashboard)/dashboard/petty-cash/boxes/new/page.tsx` | 46 | `{createPettyCashBoxAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/categories/page.tsx` | 111 | `"/dashboard/petty-cash/categories"` |
| `src/app/(dashboard)/dashboard/petty-cash/expenses/new/page.tsx` | 90 | `{createPettyCashExpenseAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/income-adjustments/new/page.tsx` | 115 | `{createPettyCashIncomeAdjustmentAction}` |
| `src/app/(dashboard)/dashboard/petty-cash/monthly-summary/page.tsx` | 253 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/petty-cash/movements/page.tsx` | 177 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/petty-cash/movements/page.tsx` | 335 | `{annulPettyCashMovementAction}` |
| `src/app/(dashboard)/dashboard/production/bottlenecks/page.tsx` | 346 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/campaigns/[id]/details/new/page.tsx` | 103 | `{addCampaignDetailAction}` |
| `src/app/(dashboard)/dashboard/production/campaigns/[id]/edit/page.tsx` | 70 | `{updateProductionCampaignAction}` |
| `src/app/(dashboard)/dashboard/production/campaigns/new/page.tsx` | 33 | `{createProductionCampaignAction}` |
| `src/app/(dashboard)/dashboard/production/campaigns/page.tsx` | 225 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/campaigns/page.tsx` | 366 | `{changeProductionCampaignStatusAction}` |
| `src/app/(dashboard)/dashboard/production/campaigns/page.tsx` | 380 | `{changeProductionCampaignStatusAction}` |
| `src/app/(dashboard)/dashboard/production/campaigns/page.tsx` | 394 | `{changeProductionCampaignStatusAction}` |
| `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/details/page.tsx` | 268 | `{deleteRecipeDetailAction}` |
| `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/[versionId]/requirements/page.tsx` | 184 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/page.tsx` | 230 | `{setCurrentRecipeVersionAction}` |
| `src/app/(dashboard)/dashboard/production/recipes/[id]/versions/page.tsx` | 253 | `{voidRecipeVersionAction}` |
| `src/app/(dashboard)/dashboard/production/recipes/new/page.tsx` | 69 | `{createTechnicalRecipeAction}` |
| `src/app/(dashboard)/dashboard/production/recipes/page.tsx` | 166 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/recipes/page.tsx` | 300 | `{toggleTechnicalRecipeStatusAction}` |
| `src/app/(dashboard)/dashboard/production/routes/[id]/edit/page.tsx` | 82 | `{updateFabricationRouteAction}` |
| `src/app/(dashboard)/dashboard/production/routes/[id]/stages/page.tsx` | 199 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/routes/[id]/stages/page.tsx` | 366 | `{toggleRouteStageStatusAction}` |
| `src/app/(dashboard)/dashboard/production/routes/new/page.tsx` | 60 | `{createFabricationRouteAction}` |
| `src/app/(dashboard)/dashboard/production/routes/page.tsx` | 159 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/routes/page.tsx` | 264 | `{toggleFabricationRouteStatusAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/page.tsx` | 317 | `{deliverWorkOrderMaterialsAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/page.tsx` | 611 | `{reopenWorkOrderMaterialsAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign/page.tsx` | 144 | `{reassignWorkOrderProgressAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/page.tsx` | 244 | `{generateWorkOrderProgressAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/[id]/progress/page.tsx` | 267 | `{updateWorkOrderProgressAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 355 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 575 | `{annulWorkOrderAction}` |
| `src/app/(dashboard)/dashboard/production/work-orders/page.tsx` | 594 | `{finishWorkOrderAction}` |
| `src/app/(dashboard)/dashboard/reports/export-history/page.tsx` | 263 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/financial/page.tsx` | 423 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/inventory/page.tsx` | 279 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/maintenance/page.tsx` | 488 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/production/page.tsx` | 279 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/profitability/page.tsx` | 192 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/sales-collections/page.tsx` | 394 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/staff/page.tsx` | 183 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/reports/suppliers-purchases/page.tsx` | 349 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/staff/attendance/new/page.tsx` | 71 | `{createAttendanceAction}` |
| `src/app/(dashboard)/dashboard/staff/attendance/page.tsx` | 139 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/staff/operators/page.tsx` | 114 | `"/dashboard/staff/operators"` |
| `src/app/(dashboard)/dashboard/staff/payment-history/new/page.tsx` | 91 | `{registerOperatorPaymentAction}` |
| `src/app/(dashboard)/dashboard/staff/payrolls/new/page.tsx` | 98 | `{generatePayrollAction}` |
| `src/app/(dashboard)/dashboard/staff/payrolls/page.tsx` | 127 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/staff/payrolls/page.tsx` | 280 | `{cancelPayrollAction}` |
| `src/app/(dashboard)/dashboard/staff/tasks/new/page.tsx` | 92 | `{createOperatorTaskAction}` |
| `src/app/(dashboard)/dashboard/staff/tasks/page.tsx` | 198 | `{cancelOperatorTaskAction}` |
| `src/app/(dashboard)/dashboard/users/page.tsx` | 111 | `{navigationHrefs.users}` |
| `src/app/(dashboard)/dashboard/users/page.tsx` | 237 | `{deactivateUserAction}` |
| `src/app/(dashboard)/dashboard/users/page.tsx` | 253 | `{activateUserAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/new/page.tsx` | 67 | `{createReusableScrapAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/page.tsx` | 126 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/page.tsx` | 250 | `{updateReusableScrapStatusAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/reusable-scraps/page.tsx` | 258 | `{updateReusableScrapStatusAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/scrap-sales/new/page.tsx` | 82 | `{createScrapSaleAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/scraps/new/page.tsx` | 59 | `{createScrapAction}` |
| `src/app/(dashboard)/dashboard/waste-scrap/scraps/page.tsx` | 132 | `Sin action explícita (revisar filtros/onSubmit)` |
| `src/components/commercial/order-form.tsx` | 185 | `{formAction}` |
| `src/components/commercial/payment-form.tsx` | 31 | `{createPaymentAction}` |
| `src/components/commercial/quote-form.tsx` | 66 | `{createQuoteAction}` |
| `src/components/commercial/receipt-form.tsx` | 54 | `{createReceiptAction}` |
| `src/components/inventory/purchase-form.tsx` | 142 | `{createPurchaseAction}` |
| `src/components/inventory/supplier-payment-form.tsx` | 31 | `{createSupplierPaymentAction}` |
| `src/components/table/row-actions.tsx` | 37 | `{action}` |
| `src/modules/auth/components/login-form.tsx` | 163 | `{formAction}` |
| `src/modules/auth/components/logout-button.tsx` | 8 | `{async () => { "use server"; await signOut({ redirectTo: "/login", }); }}` |
| `src/modules/commercial/clients/client-form.tsx` | 94 | `{formAction}` |
| `src/modules/commercial/products/product-category-manager.tsx` | 84 | `{formAction}` |
| `src/modules/commercial/products/product-category-manager.tsx` | 151 | `{formAction}` |
| `src/modules/commercial/products/product-category-manager.tsx` | 191 | `{toggleAction}` |
| `src/modules/commercial/products/product-form.tsx` | 90 | `{formAction}` |
| `src/modules/inventory/components/inventory-catalog-manager.tsx` | 98 | `{formAction}` |
| `src/modules/inventory/components/inventory-catalog-manager.tsx` | 170 | `{formAction}` |
| `src/modules/inventory/components/inventory-catalog-manager.tsx` | 226 | `{toggleAction}` |
| `src/modules/inventory/materials/material-form.tsx` | 86 | `{formAction}` |
| `src/modules/inventory/movements/inventory-output-form.tsx` | 62 | `{formAction}` |
| `src/modules/inventory/supplier-materials/supplier-material-form.tsx` | 91 | `{formAction}` |
| `src/modules/inventory/suppliers/supplier-form.tsx` | 88 | `{formAction}` |
| `src/modules/maintenance/machines/machine-form.tsx` | 85 | `{formAction}` |
| `src/modules/maintenance/spare-parts/spare-part-form.tsx` | 140 | `{formAction}` |
| `src/modules/petty-cash/categories/expense-category-form.tsx` | 65 | `{formAction}` |
| `src/modules/production/recipe-details/recipe-detail-form.tsx` | 107 | `{formAction}` |
| `src/modules/production/recipes/components/recipe-version-form.tsx` | 151 | `{createRecipeVersionAction}` |
| `src/modules/production/stages/stage-form.tsx` | 123 | `{formAction}` |
| `src/modules/production/work-orders/close-materials-form.tsx` | 60 | `{closeWorkOrderMaterialsAction}` |
| `src/modules/production/work-orders/components/work-order-form.tsx` | 295 | `{createWorkOrderAction}` |
| `src/modules/production/work-orders/material-movement-form.tsx` | 52 | `{ isReturn ? returnWorkOrderMaterialAction : deliverAdditionalMaterialAction }` |
| `src/modules/staff/operators/operator-form.tsx` | 79 | `{formAction}` |
| `src/modules/users/reset-password-form.tsx` | 50 | `{formAction}` |
| `src/modules/users/user-form.tsx` | 86 | `{formAction}` |

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
| `src/modules/maintenance/machines/actions.ts` | createMachineAction, updateMachineAction, updateMachineStatusAction, toggleMachineStatusAction |
| `src/modules/maintenance/preventive/actions.ts` | createPreventiveMaintenanceAction, updatePreventiveMaintenanceStatusAction |
| `src/modules/maintenance/repairs/actions.ts` | createRepairAction, updateRepairStatusAction |
| `src/modules/maintenance/spare-parts/actions.ts` | createSparePartAction, updateSparePartAction, updateSparePartStatusAction, toggleSparePartStatusAction |
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
| `src/modules/staff/operators/actions.ts` | createOperatorAction, updateOperatorAction, toggleOperatorStatusAction |
| `src/modules/staff/payment-history/actions.ts` | registerOperatorPaymentAction |
| `src/modules/staff/payrolls/actions.ts` | generatePayrollAction, cancelPayrollAction |
| `src/modules/staff/tasks/actions.ts` | createOperatorTaskAction, cancelOperatorTaskAction |
| `src/modules/users/actions.ts` | createUserAction, updateUserAction, activateUserAction, deactivateUserAction, resetUserPasswordAction |
| `src/modules/waste-scrap/reusable-scraps/actions.ts` | createReusableScrapAction |
| `src/modules/waste-scrap/reusable-scraps/status-actions.ts` | updateReusableScrapStatusAction |
| `src/modules/waste-scrap/scrap-sales/actions.ts` | createScrapSaleAction |
| `src/modules/waste-scrap/scraps/actions.ts` | createScrapAction |

