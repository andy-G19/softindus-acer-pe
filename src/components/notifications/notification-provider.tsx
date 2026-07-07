"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
      toastClassName="toast-industrial"
      progressClassName="toast-industrial-progress"
    />
  );
}
