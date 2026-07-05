import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/organizations", label: "Organisations" },
  { href: "/admin/flags", label: "Flags" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-brand-100 pb-2">
      {ADMIN_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            link.href === active
              ? "bg-brand-100 text-brand-800"
              : "text-gray-600 hover:bg-brand-50 hover:text-brand-700"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
