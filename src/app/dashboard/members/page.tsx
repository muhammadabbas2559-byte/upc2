"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import { Button, Input, Select, Card, Badge, Modal, Label, ConfirmDialog, EmptyState } from "@/components/ui";
import { formatDate, daysUntil, generateQrDataUrl, formatPKR } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

type Filter = "all" | "active" | "pending" | "frozen" | "expired";

export default function MembersPage() {
  const { db, addMember, deleteMember, freezeMember, unfreezeMember } = useData();
  const { currentUser } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // New member form
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    cnic: "",
    email: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    gender: "male" as "male" | "female" | "other",
    notes: "",
  });

  const members = useMemo(() => {
    if (!db) return [];
    let list = db.members;
    if (filter !== "all") list = list.filter((m) => m.status === filter);
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (m) =>
          m.fullName.toLowerCase().includes(term) ||
          m.phone.includes(term) ||
          m.uid.toLowerCase().includes(term) ||
          (m.email || "").toLowerCase().includes(term)
      );
    }
    return list.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [db, q, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) return;
    await addMember(form);
    logAction("member.create", { name: form.fullName });
    setShowNew(false);
    setForm({
      fullName: "",
      phone: "",
      cnic: "",
      email: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      gender: "male",
      notes: "",
    });
  }

  async function handleShowQr(uid: string) {
    setQrFor(uid);
    const url = await generateQrDataUrl(`gym://checkin/${uid}`);
    setQrDataUrl(url);
  }

  if (!db) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Member Directory</h1>
          <p className="text-muted mt-1">
            {members.length} of {db.members.length} members shown
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNew(true)}>➕ New Member</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name, phone, UID, email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Ending soon</option>
            <option value="frozen">Frozen</option>
            <option value="expired">Expired</option>
          </Select>
        </div>

        {members.length === 0 ? (
          <EmptyState
            icon="🏋️"
            title="No members found"
            description="Register your first member to start tracking memberships, check-ins, and loyalty tokens."
            action={
              <Button onClick={() => setShowNew(true)}>Register First Member</Button>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Tokens</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const plan = m.subscriptionId ? db.plans.find((p) => p.id === m.subscriptionId) : null;
                  const days = daysUntil(m.subscriptionEnd);
                  return (
                    <tr key={m.id}>
                      <td className="font-mono text-xs text-accent">{m.uid}</td>
                      <td>
                        <Link
                          href={`/dashboard/members/${m.id}`}
                          className="font-semibold hover:text-accent transition"
                        >
                          {m.fullName}
                        </Link>
                      </td>
                      <td className="text-muted">{m.phone}</td>
                      <td>{plan?.name || <span className="text-dim">—</span>}</td>
                      <td>
                        <Badge variant={m.status as never}>{m.status}</Badge>
                      </td>
                      <td className="text-muted text-sm">
                        {m.subscriptionEnd ? (
                          <>
                            {formatDate(m.subscriptionEnd)}
                            {m.status === "pending" && (
                              <span className="ml-2 text-warning">({days}d)</span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className="font-mono text-accent font-semibold">
                          🪙 {m.loyaltyTokens}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <Link href={`/dashboard/members/${m.id}`} className="btn btn-ghost !py-1.5 !px-2 !text-xs">
                            View
                          </Link>
                          <button
                            onClick={() => handleShowQr(m.uid)}
                            className="btn btn-ghost !py-1.5 !px-2 !text-xs"
                            title="View QR"
                          >
                            QR
                          </button>
                          {m.status === "frozen" ? (
                            <button
                              onClick={() => {
                                unfreezeMember(m.id);
                                logAction("member.unfreeze", { id: m.id });
                              }}
                              className="btn btn-secondary !py-1.5 !px-2 !text-xs"
                            >
                              Unfreeze
                            </button>
                          ) : can(currentUser, "member.freeze") ? (
                            <button
                              onClick={() => {
                                freezeMember(m.id);
                                logAction("member.freeze", { id: m.id });
                              }}
                              className="btn btn-secondary !py-1.5 !px-2 !text-xs"
                            >
                              Freeze
                            </button>
                          ) : null}
                          {can(currentUser, "member.delete") && (
                            <button
                              onClick={() => setConfirmDelete(m.id)}
                              className="btn btn-danger !py-1.5 !px-2 !text-xs"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New member modal */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Register New Member"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-member-form">
              Create Member
            </Button>
          </>
        }
      >
        <form id="new-member-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name *</Label>
              <Input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>CNIC</Label>
              <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as never })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Emergency Contact Name</Label>
              <Input
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
              />
            </div>
            <div>
              <Label>Emergency Contact Phone</Label>
              <Input
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted">
            After creating, assign a subscription plan from the member profile to activate their membership.
            All data is stored encrypted and offline.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete member?"
        message="This permanently removes the member and all of their transactions and attendance records. This action is logged and requires superuser authority."
        danger
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteMember(confirmDelete);
            logAction("member.delete", { id: confirmDelete });
          }
          setConfirmDelete(null);
        }}
      />

      <Modal open={!!qrFor} onClose={() => { setQrFor(null); setQrDataUrl(null); }} title={`Member QR: ${qrFor}`}>
        <div className="text-center">
          {qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="QR code" className="mx-auto rounded-xl border border-app p-2" />
              <p className="text-xs text-muted mt-4 font-mono">gym://checkin/{qrFor}</p>
              <p className="text-sm mt-3">Scan at turnstile / check-in desk.</p>
              <Button
                className="mt-4"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrDataUrl;
                  a.download = `${qrFor}-qr.png`;
                  a.click();
                }}
              >
                Download PNG
              </Button>
            </>
          ) : (
            <div className="text-muted py-6">Generating QR…</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
