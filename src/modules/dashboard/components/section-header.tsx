type SectionHeaderProps = {
  title: string;
  description?: string;
};

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="space-y-2 border-l-2 border-primary/80 pl-3">
      <h3 className="text-xl font-semibold text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
