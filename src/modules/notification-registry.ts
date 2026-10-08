import type {
  NotificationCatalog,
  NotificationDefinition,
} from "@/lib/notification-catalog";
import { authNotifications } from "@/modules/auth/notifications";
import { commercialNotifications } from "@/modules/commercial/notifications";
import { costsNotifications } from "@/modules/costs/notifications";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import { pettyCashNotifications } from "@/modules/petty-cash/notifications";
import { productionNotifications } from "@/modules/production/notifications";
import { staffNotifications } from "@/modules/staff/notifications";
import { usersNotifications } from "@/modules/users/notifications";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";

// Catalogo de mensajes de cada area, con la carpeta de src/modules que emite
// sus claves. El orden es el del catalogo que tenia el puente ?toast=.
export const notificationCatalogs = {
  auth: authNotifications,
  commercial: commercialNotifications,
  inventory: inventoryNotifications,
  maintenance: maintenanceNotifications,
  production: productionNotifications,
  costs: costsNotifications,
  staff: staffNotifications,
  users: usersNotifications,
  "petty-cash": pettyCashNotifications,
  "waste-scrap": wasteScrapNotifications,
} satisfies Record<string, NotificationCatalog>;

type NotificationCatalogs = typeof notificationCatalogs;

// Clave de cualquier mensaje del registro.
export type NotificationKey = {
  [Area in keyof NotificationCatalogs]: keyof NotificationCatalogs[Area];
}[keyof NotificationCatalogs];

// Registro comun: todas las claves en un objeto normal, en el orden de las
// areas, como el catalogo que reemplaza. Una clave repetida en dos areas se
// pisaria en silencio con la del area posterior: notification-registry.test.ts
// lo impide y comprueba que cada clave este en el catalogo del area que la
// emite.
export const notificationRegistry: Record<NotificationKey, NotificationDefinition> =
  Object.assign({}, ...Object.values(notificationCatalogs));
