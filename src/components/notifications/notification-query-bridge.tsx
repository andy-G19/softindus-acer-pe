"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { NotificationCatalog } from "@/lib/notification-catalog";
import { notify } from "@/lib/notifications";
import { notificationRegistry } from "@/modules/notification-registry";

// Adaptador de compatibilidad: las acciones que redirigen con ?toast=<clave>
// muestran el mensaje que el registro define para esa clave. Los mensajes
// viven en src/modules/<area>/notifications.ts. Se consulta por propiedad,
// como el catalogo que tenia este archivo.
const toastMessages: NotificationCatalog = notificationRegistry;

export function NotificationQueryBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const displayedToastRef = useRef<string | null>(null);

  useEffect(() => {
    const toastKey = searchParams.get("toast");

    if (!toastKey || displayedToastRef.current === toastKey) {
      return;
    }

    displayedToastRef.current = toastKey;

    const definition = toastMessages[toastKey];

    if (definition) {
      notify(definition);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("toast");

    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
