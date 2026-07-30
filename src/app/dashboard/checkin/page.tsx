"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useData } from "@/context/DataContext";
import { Card, Button, Input, Badge, EmptyState } from "@/components/ui";
import { formatDate, daysUntil, formatPKR } from "@/lib/utils";
import { logAction } from "@/lib/logger";
import { can } from "@/lib/rbac";
import { useAuth } from "@/context/AuthContext";

export default function CheckInPage() {
  const { db, checkIn, checkOut } = useData();
  const { currentUser } = useAuth();
  const [q, setQ] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const processingQrRef = useRef(false);

  const results = useMemo(() => {
    if (!db) return [];
    const term = q.trim().toLowerCase();
    if (!term) return db.members.filter((m) => m.status === "active").slice(0, 20);
    return db.members
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(term) ||
          m.uid.toLowerCase().includes(term) ||
          m.phone.includes(term)
      )
      .slice(0, 30);
  }, [db, q]);

  async function handleCheckIn(memberId: string, method: "manual" | "qr" = "manual") {
    setError(null);
    setSuccess(null);
    try {
      await checkIn(memberId, method);
      const m = db?.members.find((x) => x.id === memberId);
      if (m) {
        setSuccess(`Checked in ${m.fullName} at ${new Date().toLocaleTimeString()}`);
        logAction("checkin", { memberId, method });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCheckOut(memberId: string) {
    setError(null);
    setSuccess(null);
    try {
      await checkOut(memberId);
      const member = db?.members.find((item) => item.id === memberId);
      if (member) {
        setSuccess(`Checked out ${member.fullName} at ${new Date().toLocaleTimeString()}`);
        logAction("checkout", { memberId });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function processQrText(text: string) {
    if (processingQrRef.current) return;
    const value = text.trim();
    if (!value.startsWith("gym://checkin/")) return;
    processingQrRef.current = true;
    setError(null);
    setQ("");
    try {
      const uid = value.replace("gym://checkin/", "").trim();
      const member = db?.members.find((x) => x.uid === uid);
      if (!member) throw new Error("QR code is not linked to a registered member");
      await handleCheckIn(member.id, "qr");
      setCameraOpen(false);
    } finally {
      processingQrRef.current = false;
    }
  }

  // USB/Bluetooth scanners act as keyboards. The input is focused automatically
  // and a complete gym:// value is processed as soon as it arrives.
  async function handleScannerInput(value: string) {
    setQ(value);
    if (value.trim().startsWith("gym://checkin/")) await processQrText(value);
  }

  async function handleScanPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.startsWith("gym://checkin/")) {
      e.preventDefault();
      await processQrText(text);
    }
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setCameraError(null);

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
        if (cancelled || !result) return;
        await processQrText(result.getText());
      })
      .then((controls) => {
        if (cancelled) controls.stop();
        else scannerControlsRef.current = controls;
      })
      .catch(() => {
        if (!cancelled) setCameraError("Unable to access the camera. Check browser permission and try again.");
      });

    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [cameraOpen]);

  if (!db) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todays = db.attendance
    .filter((a) => new Date(a.checkedInAt) >= today)
    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Quick Check-in</h1>
        <p className="text-muted mt-1">
          Search by name, UID, or phone. Connected QR scanners work automatically; use the camera button for camera scanning.
        </p>
      </div>

      <Card>
        <div className="flex gap-3">
          <Input
            placeholder="Scan QR or type name / UID..."
            value={q}
            autoFocus
            onChange={(e) => handleScannerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") processQrText(q);
            }}
            onPaste={handleScanPaste}
          />
          <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCameraError(null);
                setCameraOpen(true);
              }}
              title="Scan with camera"
              aria-label="Scan with camera"
            >
              📷 Camera
            </Button>
        </div>
        {cameraOpen && (
          <div className="mt-4 rounded-xl border border-app bg-black p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Scan member QR code</div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCameraOpen(false)}>
                Close camera
              </Button>
            </div>
            <video ref={videoRef} className="w-full max-h-80 rounded-lg object-cover" muted playsInline />
            {cameraError && <div className="mt-2 text-sm text-danger">{cameraError}</div>}
          </div>
        )}
        {success && (
          <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/40 text-green-400 text-sm">
            ✅ {success}
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="font-bold text-lg mb-4">
              {q ? "Search Results" : "Active Members"}
            </h2>
            {results.length === 0 ? (
              <EmptyState icon="🔍" title="No matching members" />
            ) : (
              <div className="space-y-2">
                {results.map((m) => {
                  const plan = m.subscriptionId ? db.plans.find((p) => p.id === m.subscriptionId) : null;
                  const days = daysUntil(m.subscriptionEnd);
                  const lastCheckIn = db.attendance
                    .filter((attendance) => attendance.memberId === m.id)
                    .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())[0];
                  const cooldownMs = 12 * 60 * 60 * 1000;
                  const cooldownRemaining = lastCheckIn
                    ? cooldownMs - (Date.now() - new Date(lastCheckIn.checkedInAt).getTime())
                    : 0;
                  const inCooldown = cooldownRemaining > 0;
                  const activeCheckIn = db.attendance.find(
                    (attendance) => attendance.memberId === m.id && !attendance.checkedOutAt
                  );
                  const canCheckin = m.status !== "expired" && m.status !== "frozen" && !inCooldown;
                  const cooldownLabel = inCooldown
                    ? ` · available in ${Math.ceil(cooldownRemaining / 3_600_000)}h`
                    : "";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-app hover:border-[var(--accent)] transition"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white"
                        style={{ background: "var(--accent)" }}
                      >
                        {m.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{m.fullName}</span>
                          <Badge variant={m.status as never}>{m.status}</Badge>
                        </div>
                        <div className="text-xs text-muted truncate">
                          {m.uid} · {plan?.name || "No plan"}
                          {m.status === "pending" && ` · ${days}d left`}
                          {m.status === "frozen" && " · frozen"}
                          {cooldownLabel}
                        </div>
                      </div>
                      {activeCheckIn ? (
                        <Button size="sm" variant="secondary" onClick={() => handleCheckOut(m.id)}>
                          ↪ Check-out
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!canCheckin}
                          onClick={() => handleCheckIn(m.id, "manual")}
                        >
                          ✓ Check-in
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="font-bold text-lg mb-4">Today's Attendance ({todays.length})</h2>
          {todays.length === 0 ? (
            <p className="text-muted text-sm text-center py-6">No check-ins yet today.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {todays.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-app text-sm"
                >
                  <div>
                    <div className="font-semibold">{r.memberName}</div>
                    <div className="text-xs text-muted">
                      {new Date(r.checkedInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {r.method}
                    </div>
                  </div>
                  {r.checkedOutAt ? (
                    <div className="text-right text-xs text-muted">
                      <div className="text-accent">Checked out</div>
                      {new Date(r.checkedOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleCheckOut(r.memberId)}>
                      Check-out
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
