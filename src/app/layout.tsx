import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Subterra Clash", template: "%s · Subterra Clash" },
  description: "Detecting conflicts in shared underground works. Synthetic demonstration data.",
};

export const viewport: Viewport = { themeColor: "#e8e8e6" };

/**
 * Document shell only. The engineering dashboard and the public portal each load their own data in
 * their own layout, so public pages never receive the internal engineering dataset.
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
