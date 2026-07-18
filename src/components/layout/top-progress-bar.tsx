"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  finishNavProgress,
  getNavProgressServerSnapshot,
  getNavProgressSnapshot,
  subscribeNavProgress,
} from "@/lib/nav-progress";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { active, value } = useSyncExternalStore(
    subscribeNavProgress,
    getNavProgressSnapshot,
    getNavProgressServerSnapshot,
  );

  const routeKeyRef = useRef(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    const routeKey = `${pathname}?${searchParams.toString()}`;

    if (routeKeyRef.current !== routeKey) {
      routeKeyRef.current = routeKey;
      finishNavProgress();
    }
  }, [pathname, searchParams]);

  return (
    <div className="nav-progress-track" aria-hidden="true">
      <div
        className="nav-progress-fill"
        data-active={active}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
