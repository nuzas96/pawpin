import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "PawPin — Drop a Pin, Save a Stray",
  description:
    "A location-based community app to report stray cats, build persistent cat profiles, and coordinate feeding, TNR, medical care, and adoption.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-[var(--background)]">
        <Suspense fallback={<div className="h-14 border-b border-brand-100" />}>
          {/* Navbar reads the session; Suspense keeps first paint fast. */}
          <Navbar />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
