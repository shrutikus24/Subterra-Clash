import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="px-3 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-ink-2">That view does not exist.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/" className="inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-white">
            Back to overview
          </Link>
          <Link href="/public" className="inline-block rounded-full border border-line px-5 py-2 text-sm font-medium hover:bg-sunken">
            Public works portal
          </Link>
        </div>
      </div>
    </main>
  );
}
