"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type BackButtonProps = {
  fallbackHref: string;
  label?: string;
  className?: string;
};

export function BackButton({
  fallbackHref,
  label = "Volver",
  className,
}: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    const hasHistory = window.history.length > 1;
    const referrer = document.referrer;
    const hasInternalReferrer =
      referrer.length > 0 && referrer.startsWith(window.location.origin);

    if (hasHistory && hasInternalReferrer) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
