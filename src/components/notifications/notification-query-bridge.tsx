"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { NotificationCatalog } from "@/lib/notification-catalog";
import { notify } from "@/lib/notifications";
import { notificationRegistry } from "@/modules/notification-registry";

// Adaptador de compatibilidad: las acciones que redirigen con ?toast=<clave>
// muestran el mensaje que el registro define para esa clave. Los mensajes
// viven en src/modules/<area>/notifications.ts. Solo cuentan las claves
// propias del registro: las heredadas de Object (toString, constructor...)
// son claves sin entrada.
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

    if (Object.hasOwn(toastMessages, toastKey)) {
      notify(toastMessages[toastKey]);
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
