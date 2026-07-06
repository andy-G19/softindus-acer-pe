type EmptyStateProps = {
  label: string;
};

export function EmptyState({ label }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-secondary/45 px-4 py-5 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
