"use client";

import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-lg rounded-3xl border border-line bg-card p-6 text-center">
      <TriangleAlert className="mx-auto size-6 text-sev-critical" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">This view could not be displayed</h1>
      <p className="mt-1 text-sm text-ink-2">{error.message || "An unexpected error occurred."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/90"
      >
        Try again
      </button>
    </div>
  );
}
