// Simbolos de los avisos, copiados de la propuesta «Estados (mensajes temporales)» del responsable
// (2026-11-20): van dentro de la insignia redonda que pinta el adaptador
// (src/styles/adapters/toastify.css). No son los de lucide porque su «i» trae su propio circulo, que
// dentro de la insignia se veria como un circulo dentro de otro. Son decorativos: el titulo del
// aviso dice que paso.
const PATHS = {
  success: ["m5 12 5 5 9-10"],
  error: ["M12 7.5v5", "M12 16.25h.01"],
  warning: ["m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z", "M12 9v4", "M12 17h.01"],
  info: ["M12 16v-4", "M12 8h.01"],
} as const;

// Toastify llama al icono con el tipo del aviso; solo la fachada y el proveedor importan toastify,
// asi que el tipo de las props se declara aqui (es el mismo TypeOptions de la libreria).
type ToastIconProps = {
  type: "info" | "success" | "warning" | "error" | "default";
};

export function ToastIcon({ type }: ToastIconProps) {
  if (type === "default") {
    return null;
  }

  return (
    <svg
      data-slot="toast-icon"
      data-type={type}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "error" ? <circle cx="12" cy="12" r="9" /> : null}
      {PATHS[type].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
