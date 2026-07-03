"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function SessionIdleGuard() {
  const timerRef = useRef<number | null>(null);
  const signedOutRef = useRef(false);

  useEffect(() => {
    function clearIdleTimer() {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    }

    function scheduleIdleTimer() {
      clearIdleTimer();

      timerRef.current = window.setTimeout(() => {
        if (signedOutRef.current) {
          return;
        }

        signedOutRef.current = true;
        void signOut({
          callbackUrl: "/login?reason=idle",
        });
      }, IDLE_TIMEOUT_MS);
    }

    scheduleIdleTimer();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, scheduleIdleTimer, {
        passive: true,
      });
    }

    return () => {
      clearIdleTimer();

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, scheduleIdleTimer);
      }
    };
  }, []);

  // El cierre del navegador no invalida necesariamente el JWT; la seguridad se
  // apoya en logout manual, expiracion maxima y cierre por inactividad.
  return null;
}
