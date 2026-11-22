export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">This section is built in a later phase.</p>
    </div>
  );
}
