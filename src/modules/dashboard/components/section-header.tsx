type SectionHeaderProps = {
  title: string;
  description?: string;
};

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="flex gap-4">
      <div className="tempered-rail mt-1 self-stretch" aria-hidden="true" />
      <div className="space-y-2">
        <h3 className="font-heading text-[19px] font-semibold leading-tight text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
