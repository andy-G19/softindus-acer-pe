import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuth } from "@/lib/authz";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return <DashboardShell session={session}>{children}</DashboardShell>;
}