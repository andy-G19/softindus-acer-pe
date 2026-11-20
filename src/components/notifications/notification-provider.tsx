"use client";

import { cssTransition, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Entrada y salida del diseno de mensajes y estados: las animaciones viven en
// src/styles/adapters/toastify.css con estos nombres de clase.
const toastTransition = cssTransition({
  enter: "toast-industrial-enter",
  exit: "toast-industrial-exit",
});

export function NotificationProvider() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick={false}
      pauseOnHover
      draggable
      theme="dark"
      limit={4}
      transition={toastTransition}
    />
  );
}
