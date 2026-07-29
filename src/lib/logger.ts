/**
 * Structured action logger — every action is appended to the active user's
 * local log file (`logs/user_<id>.log` in the conceptual filesystem,
 * implemented as localStorage keys `gym:db:v1:logs:<id>` and exportable as a
 * Unix-style `.log` text file).
 *
 * ONLY the superuser may read/clear arbitrary logs. Ordinary users trigger
 * log writes but cannot read them.
 */
import { appendUserLog } from "./db";
import { getCurrentUser } from "./db";
import type { LogEntry } from "./schema";

let _queue: LogEntry[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

export function logAction(action: string, detail?: Record<string, unknown> | string) {
  const user = getCurrentUser();
  if (!user) return;
  const entry: LogEntry = {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    userId: user.id,
    username: user.username,
    action,
    detail: typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : undefined,
    timestamp: new Date().toISOString(),
  };
  _queue.push(entry);
  // Defer writes so rapid bursts don't thrash localStorage.
  if (!_flushTimer) {
    _flushTimer = setTimeout(flushLogs, 250);
  }
}

export function flushLogs() {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  const entries = _queue;
  _queue = [];
  for (const e of entries) appendUserLog(e);
}

/** Install a global flush on page hide. */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushLogs);
}
