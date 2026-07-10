import { redirect } from "next/navigation";

import { getActiveUserSession } from "@/lib/authz";

export default async function HomePage() {
  const session = await getActiveUserSession();

  if (session) {
    redirect("/dashboard");
  }

  redirect("/login");
}