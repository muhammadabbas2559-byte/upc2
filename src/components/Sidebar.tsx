"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can } from "@/lib/rbac";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";
import BrandMark from "@/components/BrandMark";

const Icon = ({ path }: { path: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const ICONS = {
  dashboard: "M3 12l2-2 4 4 8-8 4 4M3 21h18",
  members: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  inventory: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  plans: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  finance: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  checkin: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  logs: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const { db } = useData();

  const items: { href: string; label: string; icon: keyof typeof ICONS; perm?: string }[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/dashboard/members", label: "Members", icon: "members" },
    { href: "/dashboard/checkin", label: "Check-in", icon: "checkin" },
    { href: "/dashboard/inventory", label: "Inventory", icon: "inventory" },
    { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "plans" },
    { href: "/dashboard/finances", label: "Finances", icon: "finance", perm: "finance.view" },
    { href: "/dashboard/logs", label: "Audit Logs", icon: "logs", perm: "logs.view" },
    { href: "/dashboard/settings", label: "Settings", icon: "settings", perm: "settings.view" },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-app bg-surface flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-app">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <BrandMark size={34} />
          </div>
          <div>
            <div className="font-black tracking-tight leading-none">Obsidian Gym Manager</div>
            <div className="text-xs text-muted mt-1">Offline Console · v1.0</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items
          .filter((i) => !i.perm || can(currentUser, i.perm as never))
          .map((i) => {
            const active =
              i.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname?.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={cn("sidebar-item", active && "active")}
              >
                <Icon path={ICONS[i.icon]} />
                <span>{i.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="p-3 border-t border-app">
        <div className="rounded-xl bg-surface-2 p-3 border border-app">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-bold text-xs">
              {currentUser?.displayName?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{currentUser?.displayName}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">
                {currentUser?.role === "superuser" ? "Superuser" : "Staff"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
