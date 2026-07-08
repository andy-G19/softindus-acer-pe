import { LogOut } from "lucide-react";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";

        await signOut({
          redirectTo: "/login",
        });
      }}
    >
      <Button type="submit" variant="destructive">
        <LogOut />
        Cerrar sesión
      </Button>
    </form>
  );
}
