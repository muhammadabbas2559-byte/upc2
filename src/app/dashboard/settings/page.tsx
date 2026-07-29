"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Card, Button, Input, Label, Badge, ConfirmDialog } from "@/components/ui";
import { can } from "@/lib/rbac";
import { destroyEverything } from "@/lib/db";
import { logAction, flushLogs } from "@/lib/logger";
import type { SystemSettings } from "@/lib/schema";

export default function SettingsPage() {
  const { currentUser, refresh, createUser, publicUsers, deleteUser } = useAuth();
  const { db, updateSettings } = useData();

  const [form, setForm] = useState<SystemSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New user form
  const [nuUsername, setNuUsername] = useState("");
  const [nuDisplay, setNuDisplay] = useState("");
  const [nuPassword, setNuPassword] = useState("");
  const [nuSuPwd, setNuSuPwd] = useState("");
  const [nuError, setNuError] = useState<string | null>(null);
  const [nuBusy, setNuBusy] = useState(false);

  // Danger zone
  const [destroyConfirm, setDestroyConfirm] = useState(false);
  const [destroyPwd, setDestroyPwd] = useState("");
  const [destroyError, setDestroyError] = useState<string | null>(null);

  // Delete user
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteSuPwd, setDeleteSuPwd] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (db?.settings) setForm({ ...db.settings });
  }, [db]);

  if (!can(currentUser, "settings.view")) {
    return (
      <div className="text-muted text-center py-20">
        You don&apos;t have permission to view settings.
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await updateSettings(form);
      logAction("settings.update");
      flushLogs();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setNuError(null);
    setNuBusy(true);
    try {
      await createUser(nuUsername.trim(), nuPassword, nuDisplay.trim() || nuUsername.trim(), nuSuPwd);
      setNuUsername(""); setNuDisplay(""); setNuPassword(""); setNuSuPwd("");
      setNuError("User created successfully.");
    } catch (err) {
      setNuError((err as Error).message);
    } finally {
      setNuBusy(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteConfirm) return;
    setDeleteError(null);
    try {
      await deleteUser(deleteConfirm, deleteSuPwd);
      setDeleteConfirm(null);
      setDeleteSuPwd("");
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  }

  async function handleDestroy() {
    setDestroyError(null);
    try {
      logAction("destroy_everything");
      flushLogs();
      await destroyEverything(destroyPwd);
      // The database and bootstrap metadata are gone; synchronize the auth
      // context so the app returns to the first-run setup screen.
      refresh();
    } catch (err) {
      setDestroyError((err as Error).message);
    }
  }

  if (!form) return <div className="text-muted">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-muted mt-1">Gym configuration, users, and danger zone.</p>
      </div>

      {/* General settings */}
      <Card>
        <h2 className="font-bold text-lg mb-4">General</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Gym Name</Label>
            <Input
              value={form.gymName}
              onChange={(e) => setForm({ ...form, gymName: e.target.value })}
              placeholder="IronForge Gym"
              disabled={!can(currentUser, "settings.edit")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                placeholder="PKR"
                disabled={!can(currentUser, "settings.edit")}
              />
            </div>
            <div>
              <Label>Subscription Expiry Warning (days)</Label>
              <Input
                type="number"
                value={form.subscriptionExpiryWarningDays}
                onChange={(e) =>
                  setForm({ ...form, subscriptionExpiryWarningDays: Number(e.target.value) })
                }
                disabled={!can(currentUser, "settings.edit")}
              />
            </div>
          </div>
          <div>
            <Label>Low Stock Threshold (global)</Label>
            <Input
              type="number"
              value={form.lowStockThresholdGlobal}
              onChange={(e) =>
                setForm({ ...form, lowStockThresholdGlobal: Number(e.target.value) })
              }
              disabled={!can(currentUser, "settings.edit")}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="qr"
              type="checkbox"
              checked={form.qrAttendanceEnabled}
              onChange={(e) => setForm({ ...form, qrAttendanceEnabled: e.target.checked })}
              disabled={!can(currentUser, "settings.edit")}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <label htmlFor="qr" className="text-sm font-medium">Enable QR Code Attendance</label>
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400">
              {error}
            </div>
          )}
          {saved && (
            <div className="text-sm p-3 rounded-lg border border-green-500/40 bg-green-500/10 text-green-400">
              ✓ Settings saved
            </div>
          )}
          {can(currentUser, "settings.edit") && (
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save Settings"}
            </Button>
          )}
        </form>
      </Card>

      {/* Users */}
      {can(currentUser, "user.create") && (
        <Card>
          <h2 className="font-bold text-lg mb-4">User Accounts</h2>
          <div className="space-y-3 mb-6">
            {publicUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-xl border border-app bg-surface-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{
                      background: u.role === "superuser" ? "var(--accent)" : "var(--bg-4)",
                      color: u.role === "superuser" ? "white" : "var(--muted)",
                    }}
                  >
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{u.displayName}</div>
                    <div className="text-xs text-muted">@{u.username}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.role === "superuser" ? "superuser" : "user"}>
                    {u.role === "superuser" ? "SUDO" : "USER"}
                  </Badge>
                  {u.role !== "superuser" && can(currentUser, "user.delete") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeleteConfirm(u.id); setDeleteSuPwd(""); setDeleteError(null); }}
                    >
                      🗑
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {deleteConfirm && (
            <div className="mb-4 p-4 rounded-xl border border-red-500/40 bg-red-500/10 space-y-3">
              <p className="text-sm text-red-400 font-semibold">Confirm deletion — enter your superuser password:</p>
              <Input
                type="password"
                value={deleteSuPwd}
                onChange={(e) => setDeleteSuPwd(e.target.value)}
                placeholder="Superuser password"
              />
              {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}
              <div className="flex gap-2">
                <Button variant="danger" onClick={handleDeleteUser}>Confirm Delete</Button>
                <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              </div>
            </div>
          )}

          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted">Add New User</h3>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username</Label>
                <Input value={nuUsername} onChange={(e) => setNuUsername(e.target.value)} placeholder="staff1" />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={nuDisplay} onChange={(e) => setNuDisplay(e.target.value)} placeholder="Staff Member" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>New User Password</Label>
                <Input type="password" value={nuPassword} onChange={(e) => setNuPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <Label>Your Superuser Password</Label>
                <Input type="password" value={nuSuPwd} onChange={(e) => setNuSuPwd(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            {nuError && (
              <div className={`text-sm p-3 rounded-lg border ${nuError.includes("success") ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-red-500/40 bg-red-500/10 text-red-400"}`}>
                {nuError}
              </div>
            )}
            <Button type="submit" disabled={nuBusy}>
              {nuBusy ? "Creating..." : "Create User"}
            </Button>
          </form>
        </Card>
      )}

      {/* Danger zone */}
      {currentUser?.role === "superuser" && (
        <Card>
          <h2 className="font-bold text-lg mb-1 text-red-400">⚠ Danger Zone</h2>
          <p className="text-muted text-sm mb-4">
            Permanently destroy all encrypted data, users, and logs from this device.
            This cannot be undone.
          </p>
          {!destroyConfirm ? (
            <Button variant="danger" onClick={() => setDestroyConfirm(true)}>
              Destroy Everything
            </Button>
          ) : (
            <div className="space-y-3">
              <Input
                type="password"
                value={destroyPwd}
                onChange={(e) => setDestroyPwd(e.target.value)}
                placeholder="Superuser password to confirm"
              />
              {destroyError && <p className="text-red-400 text-sm">{destroyError}</p>}
              <div className="flex gap-2">
                <Button variant="danger" onClick={handleDestroy}>
                  Confirm — Destroy All Data
                </Button>
                <Button variant="ghost" onClick={() => setDestroyConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
