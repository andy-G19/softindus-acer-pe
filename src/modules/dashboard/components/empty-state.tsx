type EmptyStateProps = {
  label: string;
};

export function EmptyState({ label }: EmptyStateProps) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
