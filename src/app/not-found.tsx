import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-line bg-card p-6 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-ink-2">That view does not exist.</p>
      <Link href="/" className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-white">
        Back to overview
      </Link>
    </div>
  );
}
