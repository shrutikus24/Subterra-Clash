export default function Loading() {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-12" aria-label="Loading">
      <div className="h-10 w-2/3 animate-pulse rounded-full bg-card lg:col-span-12" />
      <div className="h-48 animate-pulse rounded-3xl bg-card lg:col-span-7" />
      <div className="h-48 animate-pulse rounded-3xl bg-card lg:col-span-5" />
      <div className="h-96 animate-pulse rounded-3xl bg-card lg:col-span-12" />
    </div>
  );
}
