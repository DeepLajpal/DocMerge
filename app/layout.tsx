import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DocMerge - PDF & Image Merger",
  description:
    "Merge PDFs and images into a single document. Fast, secure, and completely in-browser.",
  generator: "v0.app",
  keywords: ["PDF merge", "document merger", "image to PDF", "PDF tools"],
  authors: [{ name: "DocMerge" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "DocMerge - PDF & Image Merger",
    description:
      "Merge PDFs and images into a single document. Fast, secure, and completely in-browser.",
    type: "website",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
  colorScheme: "light",
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" suppressHydrationWarning>
        {/* Skip to main content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:outline-none"
        >
          Skip to main content
        </a>

        {/* Live region for announcements to screen readers */}
        <div
          id="live-announcer"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
