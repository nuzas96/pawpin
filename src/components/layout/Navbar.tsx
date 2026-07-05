import Link from "next/link";
import { getSessionUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ButtonLink } from "@/components/ui/Button";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

const PUBLIC_LINKS = [
  { href: "/map", label: "Live Map" },
  { href: "/cases", label: "Cases" },
  { href: "/report", label: "Report a Cat" },
  { href: "/about", label: "About" },
];

export async function Navbar() {
  const user = await getSessionUser();

  const roleLinks: { href: string; label: string }[] = [];
  if (user?.role === "volunteer") {
    roleLinks.push({ href: "/dashboard/volunteer", label: "Volunteer" });
  }
  if (user?.role === "org") {
    roleLinks.push({ href: "/dashboard/org", label: "Organisation" });
  }
  if (user?.role === "admin") {
    roleLinks.push({ href: "/admin", label: "Admin" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span aria-hidden className="text-xl">🐾</span>
          <span>PawPin</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {[...PUBLIC_LINKS, ...roleLinks].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationsBell userId={user.id} />
              <Link
                href="/profile"
                className="hidden text-sm text-gray-600 hover:text-brand-700 sm:inline"
              >
                {user.displayName || user.email} · {ROLE_LABELS[user.role]}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <ButtonLink href="/auth/sign-in" variant="ghost">
                Sign In
              </ButtonLink>
              <ButtonLink href="/auth/sign-up" variant="primary">
                Sign Up
              </ButtonLink>
            </>
          )}
        </div>
      </nav>

      {/* Mobile link row */}
      <div className="flex gap-1 overflow-x-auto border-t border-brand-50 px-3 py-2 md:hidden">
        {[...PUBLIC_LINKS, ...roleLinks].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-brand-50"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
