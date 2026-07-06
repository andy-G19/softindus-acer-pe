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
    let hasInternalReferrer = false;

    if (referrer) {
      try {
        const referrerUrl = new URL(referrer);
        hasInternalReferrer = referrerUrl.origin === window.location.origin;
      } catch {
        hasInternalReferrer = false;
      }
    }

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
        "inline-flex items-center gap-2 rounded-lg border border-border/80 bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition hover:border-primary/50 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
        className,
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
