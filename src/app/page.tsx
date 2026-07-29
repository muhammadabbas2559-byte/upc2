"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button, Input, Label, Card } from "@/components/ui";
import { useRouter } from "next/navigation";

function LoginScreen() {
  const {
    authReady,
    bootstrapped,
    publicUsers,
    currentUser,
    login,
    bootstrap,
    createUser,
  } = useAuth();
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [suPasswordForCreate, setSuPasswordForCreate] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const didAutoSelect = useRef(false);

  // A single-profile kiosk should be password-first: preselect the first
  // available local profile instead of requiring an extra click.
  useEffect(() => {
    if (didAutoSelect.current || !authReady || username || publicUsers.length === 0) return;
    didAutoSelect.current = true;
    setSelectedUserId(publicUsers[0].id);
    setUsername(publicUsers[0].username);
  }, [authReady, publicUsers, username]);

  useEffect(() => {
    if (currentUser) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = username.trim();
      if (!u || !password) throw new Error("Please select a user and enter your password");
      await login(u, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!username.trim() || !password) throw new Error("Username and password required");
      await bootstrap(username.trim(), password, displayName.trim() || "Superuser");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createUser(
        newUsername.trim(),
        newPassword,
        newDisplayName.trim() || newUsername.trim(),
        suPasswordForCreate
      );
      setShowCreate(false);
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setSuPasswordForCreate("");
      setError("User created. They can now log in.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="pulse-dot mx-auto mb-3 w-3 h-3" />
          <div className="text-muted text-sm">Reading encrypted local vault...</div>
        </div>
      </div>
    );
  }

  // First-run: bootstrap
  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-white text-3xl font-black mb-4" style={{background: "var(--accent)"}}>
              IF
            </div>
            <h1 className="text-3xl font-black tracking-tight">IronForge Gym</h1>
            <p className="text-muted mt-2">
              Secure offline management. Let's create your superuser account.
            </p>
          </div>
          <Card>
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div>
                <Label>Superuser Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                />
              </div>
              <div>
                <Label>Display Name (optional)</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Owner / Manager"
                />
              </div>
              <div>
                <Label>Superuser Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Strong password"
                />
                <p className="text-dim text-xs mt-2">
                  This password unlocks the encrypted database and grants full system privileges.
                </p>
              </div>
              {error && (
                <div className="text-sm p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Initializing secure vault..." : "Initialize System"}
              </Button>
            </form>
          </Card>
          <p className="text-dim text-xs text-center mt-6">
            All data is stored locally with AES-256 encryption. Triple backups maintained automatically.
          </p>
        </div>
      </div>
    );
  }

  // Bootstrapped: user selection
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white text-3xl font-black mb-4" style={{background: "var(--accent)"}}>
            IF
          </div>
          <h1 className="text-3xl font-black tracking-tight">IronForge Gym</h1>
          <p className="text-muted mt-1">
            Offline Management Console · All data encrypted & local
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-dim">
            <span className="pulse-dot"></span>
            System Ready · Triple-backup active
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_1.2fr] gap-6">
          {/* User directory */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Select User</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
                + New User
              </Button>
            </div>
            <div className="space-y-2">
              {publicUsers.map((u) => {
                const active = selectedUserId === u.id || username === u.username;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUserId(u.id);
                      setUsername(u.username);
                      setPassword("");
                      setError(null);
                    }}
                    className={
                      "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left " +
                      (active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-app bg-surface-2 hover:border-strong")
                    }
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                      style={{
                        background:
                          u.role === "superuser" ? "var(--accent)" : "var(--bg-4)",
                        color: u.role === "superuser" ? "white" : "var(--muted)",
                      }}
                    >
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u.displayName}</div>
                      <div className="text-xs text-muted truncate">@{u.username}</div>
                    </div>
                    {u.role === "superuser" ? (
                      <span className="badge badge-superuser">SUDO</span>
                    ) : (
                      <span className="badge badge-user">USER</span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Password form */}
          <Card>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="font-bold text-lg mb-1">
                  {username ? `Sign in as ${username}` : "Sign in"}
                </h2>
                <p className="text-muted text-sm">
                  Enter your password to unlock the encrypted database.
                </p>
              </div>
              <div>
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setSelectedUserId(null);
                  }}
                  placeholder="e.g. admin or staff"
                  autoComplete="username"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="text-sm p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Unlocking..." : "Unlock Database →"}
              </Button>
              <p className="text-dim text-xs text-center pt-2">
                Each user's password wraps a 256-bit master key. Failed attempts cannot decrypt data.
              </p>
            </form>
          </Card>
        </div>

        {/* Create user modal */}
        {showCreate && (
          <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Create New User</h2>
                <button
                  className="text-muted hover:text-accent text-2xl leading-none"
                  onClick={() => setShowCreate(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <p className="text-muted text-sm">
                  Creating a new user requires authorization with the <b>superuser password</b>.
                </p>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="staff1"
                    required
                  />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Shift Manager"
                  />
                </div>
                <div>
                  <Label>Initial Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Superuser Password (to authorize)</Label>
                  <Input
                    type="password"
                    value={suPasswordForCreate}
                    onChange={(e) => setSuPasswordForCreate(e.target.value)}
                    required
                    placeholder="Required for audit trail"
                  />
                </div>
                {error && (
                  <div className="text-sm p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400">
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginScreen />;
}
