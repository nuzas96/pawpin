import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-brand-700">🐾 PawPin</p>
          <p>Drop a Pin, Save a Stray.</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/map" className="hover:text-brand-700">Live Map</Link>
          <Link href="/report" className="hover:text-brand-700">Report</Link>
          <Link href="/cases" className="hover:text-brand-700">Cases</Link>
          <Link href="/about" className="hover:text-brand-700">About</Link>
        </nav>
        <p className="text-xs text-gray-400">
          Approximate locations shown publicly to protect cats.
        </p>
      </div>
    </footer>
  );
}
