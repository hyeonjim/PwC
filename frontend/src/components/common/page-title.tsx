export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="mt-1 text-base text-muted-foreground">{description}</p>}
    </div>
  );
}
