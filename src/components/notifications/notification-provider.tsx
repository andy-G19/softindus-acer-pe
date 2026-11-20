"use client";

import { cssTransition, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { ToastIcon } from "@/components/notifications/toast-icon";

// Entrada y salida del diseno de mensajes y estados: las animaciones viven en
// src/styles/adapters/toastify.css con estos nombres de clase.
const toastTransition = cssTransition({
  enter: "toast-industrial-enter",
  exit: "toast-industrial-exit",
});

// Abajo a la derecha, con el mas nuevo junto a la esquina (propuesta de mensajes temporales,
// 2026-11-20): arriba tapaban «Cerrar sesion».
export function NotificationProvider() {
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick={false}
      pauseOnHover
      draggable
      theme="dark"
      limit={4}
      transition={toastTransition}
      icon={ToastIcon}
    />
  );
}
