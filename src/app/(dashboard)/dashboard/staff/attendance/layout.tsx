// Asistencia con panel lateral (entrega 10.8a), como Operarios: la ranura @panel
// recibe el registro interceptado ((.)new) cuando se abre desde el listado, y
// muestra el panel encima de la lista sin perder sus filtros. Una recarga o la URL
// directa no interceptan: renderizan new/ a pagina completa y la ranura queda en
// default.tsx (nada).
export default function AttendanceLayout({
  children,
  panel,
}: LayoutProps<"/dashboard/staff/attendance">) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
