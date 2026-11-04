// Tareas con panel lateral (entrega 10.8a), como Asistencia: la ranura @panel
// recibe el registro interceptado ((.)new) cuando se abre desde el listado, y
// muestra el panel encima de la lista. Una recarga o la URL directa no
// interceptan: renderizan new/ a pagina completa y la ranura queda en default.tsx
// (nada).
export default function TasksLayout({
  children,
  panel,
}: LayoutProps<"/dashboard/staff/tasks">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
