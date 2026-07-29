"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui";
import { relativeTime } from "@/lib/utils";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

export default function TopBar() {
  const router = useRouter();
  const { currentUser, publicUsers, switchUser, logout } = useAuth();
  const { db, markNotificationRead, dismissNotification } = useData();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [suPwd, setSuPwd] = useState("");
  const [switchError, setSwitchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) {
        setSwitchOpen(false);
        setSuPwd("");
        setSwitchError(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  const unread = (db?.notifications || []).filter((n) => !n.read).length;
  const term = search.trim().toLowerCase();
  const searchResults = term
    ? [
        ...(db?.members ?? [])
          .filter((m) =>
            [m.fullName, m.uid, m.phone, m.email].some((value) =>
              value?.toLowerCase().includes(term)
            )
          )
          .map((m) => ({
            type: "Member",
            title: m.fullName,
            detail: `${m.uid} · ${m.phone}`,
            href: `/dashboard/members/${m.id}`,
          })),
        ...(db?.inventory ?? [])
          .filter((item) =>
            [item.name, item.category].some((value) =>
              value?.toLowerCase().includes(term)
            )
          )
          .map((item) => ({
            type: "Inventory",
            title: item.name,
            detail: `${item.stockQty} in stock${item.category ? ` · ${item.category}` : ""}`, 
            href: "/dashboard/inventory",
          })),
      ].slice(0, 8)
    : [];

  async function handleSwitch(userId: string, isSu: boolean) {
    try {
      await switchUser(userId, isSu ? suPwd : undefined);
      logAction("switch_user", { toUserId: userId });
      setSwitchOpen(false);
      setSuPwd("");
      setSwitchError(null);
    } catch (err) {
      setSwitchError((err as Error).message);
    }
  }

  return (
    <header className="h-16 border-b border-app bg-surface sticky top-0 z-30 px-6 flex items-center justify-between">
      <div>
        <div className="text-xs text-dim uppercase tracking-widest">Offline Management System</div>
        <div className="text-lg font-bold tracking-tight">
          {db?.settings.gymName}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Global member and inventory search */}
        <div ref={searchRef} className="relative hidden md:block w-72">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-app focus-within:border-[var(--accent)]">
            <span className="text-dim">🔍</span>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search members, items..."
              aria-label="Search members and inventory"
              className="min-w-0 flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-dim"
            />
            <span className="kbd">⌘K</span>
          </div>
          {searchOpen && search && (
            <div className="absolute left-0 right-0 top-12 bg-surface border border-strong rounded-xl shadow-2xl p-2 z-50">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.href}-${result.title}`}
                    type="button"
                    onClick={() => {
                      router.push(result.href);
                      setSearch("");
                      setSearchOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-surface-3 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{result.title}</span>
                      <span className="text-[10px] uppercase tracking-wider text-accent">{result.type}</span>
                    </div>
                    <div className="text-xs text-muted truncate">{result.detail}</div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-muted">No members or inventory items found.</div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative w-10 h-10 rounded-lg bg-surface-2 border border-app hover:border-[var(--accent)] flex items-center justify-center transition"
            aria-label="Notifications"
          >
            <span className="text-lg">🔔</span>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-96 max-h-[70vh] overflow-y-auto bg-surface border border-strong rounded-xl shadow-2xl p-2 z-40">
              <div className="px-3 py-2 border-b border-app">
                <div className="font-semibold">Notifications</div>
                <div className="text-xs text-muted">
                  {unread} unread · alerts update automatically
                </div>
              </div>
              {!db?.notifications.length && (
                <div className="p-6 text-center text-muted text-sm">
                  No notifications — you're all caught up.
                </div>
              )}
              {db?.notifications.slice().reverse().map((n) => (
                <div
                  key={n.id}
                  className={
                    "p-3 rounded-lg mb-1 cursor-pointer hover:bg-surface-3 border " +
                    (n.read ? "border-transparent" : "border-[var(--accent)]/30 bg-[var(--accent-soft)]")
                  }
                  onClick={() => markNotificationRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            background:
                              n.level === "danger"
                                ? "var(--danger)"
                                : n.level === "warning"
                                ? "var(--warning)"
                                : n.level === "success"
                                ? "var(--success)"
                                : "var(--info)",
                          }}
                        />
                        <div className="font-semibold text-sm">{n.title}</div>
                      </div>
                      <div className="text-xs text-muted mt-1 ml-4">{n.body}</div>
                      <div className="text-[10px] text-dim mt-1 ml-4">{relativeTime(n.createdAt)}</div>
                    </div>
                    <button
                      className="text-dim hover:text-danger text-lg leading-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(n.id);
                      }}
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User switcher */}
        <div className="relative" ref={switchRef}>
          <button
            onClick={() => setSwitchOpen((o) => !o)}
            className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-lg bg-surface-2 border border-app hover:border-[var(--accent)] transition"
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs"
              style={{
                background: currentUser?.role === "superuser" ? "var(--accent)" : "var(--bg-4)",
                color: currentUser?.role === "superuser" ? "white" : "var(--muted)",
              }}
            >
              {currentUser?.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold leading-tight">{currentUser?.displayName}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted leading-tight">
                {currentUser?.role}
              </div>
            </div>
            <span className="text-muted text-xs">▾</span>
          </button>

          {switchOpen && (
            <div className="absolute right-0 top-12 w-80 bg-surface border border-strong rounded-xl shadow-2xl z-40 overflow-hidden">
              <div className="px-4 py-3 border-b border-app">
                <div className="font-semibold text-sm">Switch user</div>
                <div className="text-xs text-muted">
                  Seamless account switching. Switching to superuser requires password confirmation.
                </div>
              </div>
              <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                {publicUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <button
                      key={u.id}
                      disabled={isCurrent}
                      onClick={() => {
                        if (u.role === "superuser") return; // wait for password
                        handleSwitch(u.id, false);
                      }}
                      className={
                        "w-full flex items-center gap-3 p-2 rounded-lg text-left transition " +
                        (isCurrent
                          ? "bg-[var(--accent-soft)] border border-[var(--accent)]"
                          : "hover:bg-surface-3 border border-transparent")
                      }
                    >
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs"
                        style={{
                          background: u.role === "superuser" ? "var(--accent)" : "var(--bg-4)",
                          color: u.role === "superuser" ? "white" : "var(--muted)",
                        }}
                      >
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{u.displayName}</div>
                        <div className="text-xs text-muted truncate">
                          @{u.username}
                          {u.role === "superuser" && " · Superuser"}
                        </div>
                      </div>
                      {isCurrent && <span className="badge badge-active">current</span>}
                    </button>
                  );
                })}
              </div>

              {/* Superuser password prompt only shown when superuser exists & not already */}
              {currentUser?.role !== "superuser" &&
                can(currentUser, "member.view") && (
                  <div className="p-3 border-t border-app space-y-2">
                    <div className="text-xs text-muted">
                      To switch to Superuser, enter their password:
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="input !py-2 !text-xs"
                        placeholder="Superuser password"
                        value={suPwd}
                        onChange={(e) => setSuPwd(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const su = publicUsers.find((u) => u.role === "superuser");
                          if (su) handleSwitch(su.id, true);
                        }}
                      >
                        Go
                      </Button>
                    </div>
                    {switchError && (
                      <div className="text-xs text-danger">{switchError}</div>
                    )}
                  </div>
                )}

              <div className="p-2 border-t border-app">
                <button
                  onClick={() => {
                    logout();
                  }}
                  className="w-full btn btn-secondary !justify-start"
                >
                  🚪 Lock Database / Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
