"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Card, Button, Badge, EmptyState } from "@/components/ui";
import { can } from "@/lib/rbac";
import { readUserLog, clearUserLog, exportUserLogAsText, allLogUserIds } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import type { LogEntry } from "@/lib/schema";

function triggerDownload(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LogsPage() {
  const { currentUser } = useAuth();
  const { db } = useData();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allUserIds, setAllUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUser) return;
    const isSu = currentUser.role === "superuser";
    if (isSu) {
      const ids = allLogUserIds();
      setAllUserIds(ids);
      const uid = selectedUserId ?? currentUser.id;
      setEntries(readUserLog(uid).slice().reverse());
    } else {
      setEntries(readUserLog(currentUser.id).slice().reverse());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, db, selectedUserId]);

  if (!can(currentUser, "logs.view")) {
    return (
      <div className="text-muted text-center py-20">
        You don&apos;t have permission to view audit logs.
      </div>
    );
  }

  function handleExport() {
    if (!currentUser) return;
    const uid = selectedUserId ?? currentUser.id;
    const text = exportUserLogAsText(uid);
    triggerDownload(text, `audit-${uid}-${Date.now()}.log`);
  }

  function handleClear() {
    if (!currentUser || !can(currentUser, "logs.clear")) return;
    const uid = selectedUserId ?? currentUser.id;
    clearUserLog(uid);
    setEntries([]);
  }

  const activeUserId = selectedUserId ?? currentUser?.id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Audit Logs</h1>
          <p className="text-muted mt-1">
            Session activity — encrypted per-user, exportable as plain text.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport}>
            ⬇ Export .log
          </Button>
          {can(currentUser, "logs.clear") && (
            <Button variant="danger" onClick={handleClear}>
              🗑 Clear Logs
            </Button>
          )}
        </div>
      </div>

      {/* Superuser: user selector */}
      {currentUser?.role === "superuser" && allUserIds.length > 1 && (
        <Card>
          <div className="flex flex-wrap gap-2">
            {allUserIds.map((uid) => {
              const publicUser = db?.users.find((u) => u.id === uid);
              return (
                <button
                  key={uid}
                  onClick={() => setSelectedUserId(uid)}
                  className={
                    "px-3 py-1.5 rounded-lg border text-sm font-semibold transition " +
                    (activeUserId === uid
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-accent"
                      : "border-app bg-surface-2 text-muted hover:border-strong")
                  }
                >
                  {publicUser?.displayName ?? uid.slice(0, 8)}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        {entries.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No log entries"
            description="Actions you perform will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Detail</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-muted text-xs whitespace-nowrap">
                      {formatDateTime(e.timestamp)}
                    </td>
                    <td>
                      <Badge variant="active">{e.action}</Badge>
                    </td>
                    <td className="text-muted text-xs max-w-xs truncate">
                      {e.detail ?? "—"}
                    </td>
                    <td className="text-muted text-xs">{e.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
