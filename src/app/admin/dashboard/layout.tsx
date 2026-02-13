"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/dashboard/templates", label: "Templates" },
  { href: "/admin/dashboard/shifts", label: "Shifts" },
  { href: "/admin/dashboard/bulk-signup", label: "Bulk Signup" },
  { href: "/admin/dashboard/mentors", label: "Mentors" },
  { href: "/admin/dashboard/seasons", label: "Seasons" },
  { href: "/admin/dashboard/quotes", label: "Quotes" },
  { href: "/admin/dashboard/goals", label: "Goals" },
  { href: "/admin/dashboard/attendance", label: "Attendance" },
  { href: "/admin/dashboard/students", label: "Students" },
  { href: "/admin/dashboard/settings", label: "Settings" },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 bg-navy text-white p-4 flex flex-col">
        <h2 className="text-lg font-bold text-primary-light mb-6">Admin Panel</h2>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? "bg-primary text-white"
                  : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="text-slate-400 hover:text-white text-sm py-2 text-left transition-colors"
        >
          Logout
        </button>
      </aside>
      <div className="flex-1 p-8">{children}</div>
    </div>
  );
}
