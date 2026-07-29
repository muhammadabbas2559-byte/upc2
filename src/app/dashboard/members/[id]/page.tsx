"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import {
  Button,
  Card,
  Badge,
  Modal,
  Label,
  Input,
  Select,
  ConfirmDialog,
  EmptyState,
} from "@/components/ui";
import {
  formatDate,
  formatDateTime,
  formatPKR,
  daysUntil,
  generateQrDataUrl,
} from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    db,
    freezeMember,
    unfreezeMember,
    updateMember,
    deleteMember,
    recordPurchase,
    redeemItemWithTokens,
    checkIn,
  } = useData();
  const { currentUser } = useAuth();

  const member = db?.members.find((m) => m.id === params.id);
  const [tab, setTab] = useState<"overview" | "transactions" | "trophies" | "attendance">(
    "overview"
  );
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planPaidWithTokens, setPlanPaidWithTokens] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemPaidWithTokens, setItemPaidWithTokens] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const memberTxs = useMemo(
    () =>
      db?.transactions
        .filter((t) => t.memberId === member?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? [],
    [db, member]
  );
  const memberAttendance = useMemo(
    () =>
      db?.attendance
        .filter((a) => a.memberId === member?.id)
        .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()) ?? [],
    [db, member]
  );

  if (!db || !member) {
    return (
      <EmptyState
        icon="❓"
        title="Member not found"
        action={
          <Link href="/dashboard/members" className="btn btn-primary">
            Back to directory
          </Link>
        }
      />
    );
  }

  // Narrowed non-null for closures/JSX below (TS doesn't always narrow into callbacks).
  const m = member;
  const d = db;

  const plan = m.subscriptionId
    ? d.plans.find((p) => p.id === m.subscriptionId)
    : null;
  const daysLeft = daysUntil(m.subscriptionEnd);

  async function assignPlan() {
    if (!selectedPlanId) return;
    setActionError(null);
    try {
      await recordPurchase({
        type: "membership_purchase",
        memberId: m.id,
        planId: selectedPlanId,
        paidWithTokens: planPaidWithTokens,
      });
      logAction("member.assign_plan", { memberId: m.id, planId: selectedPlanId });
      setShowPlanModal(false);
      setSelectedPlanId("");
      setPlanPaidWithTokens(false);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function buyItem() {
    if (!selectedItemId) return;
    const item = d.inventory.find((i) => i.id === selectedItemId);
    if (!item) return;
    setActionError(null);
    try {
      if (itemPaidWithTokens && item.isRedeemable) {
        await redeemItemWithTokens(m.id, item.id, itemQty);
        logAction("member.redeem_item", { memberId: m.id, itemId: item.id });
      } else {
        await recordPurchase({
          type: "item_purchase",
          memberId: m.id,
          itemId: selectedItemId,
          quantity: itemQty,
          paidWithTokens: false,
        });
        logAction("member.buy_item", { memberId: m.id, itemId: item.id });
      }
      setShowItemModal(false);
      setSelectedItemId("");
      setItemQty(1);
      setItemPaidWithTokens(false);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function doCheckIn() {
    await checkIn(m.id);
    logAction("member.checkin", { memberId: m.id });
  }

  async function showQr() {
    const url = await generateQrDataUrl(`gym://checkin/${m.uid}`);
    setQrUrl(url);
  }

  function startEdit() {
    setEditForm({
      fullName: m.fullName,
      phone: m.phone,
      email: m.email || "",
      cnic: m.cnic || "",
      address: m.address || "",
      emergencyContactName: m.emergencyContactName || "",
      emergencyContactPhone: m.emergencyContactPhone || "",
      notes: m.notes || "",
    });
    setShowEdit(true);
  }

  async function saveEdit() {
    await updateMember(m.id, editForm as never);
    logAction("member.edit", { memberId: m.id });
    setShowEdit(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted mb-2">
        <Link href="/dashboard/members" className="hover:text-accent">
          Members
        </Link>
        <span>/</span>
        <span>{m.fullName}</span>
      </div>

      {/* Hero */}
      <Card accent>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white"
              style={{ background: "var(--accent)" }}
            >
              {m.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black tracking-tight">{m.fullName}</h1>
                <Badge variant={m.status as never}>{m.status}</Badge>
                {plan && <Badge variant="superuser">{plan.name}</Badge>}
              </div>
              <div className="text-muted text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>📱 {m.phone}</span>
                {m.email && <span>✉️ {m.email}</span>}
                <span className="font-mono text-accent">UID: {m.uid}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-dim">Joined</div>
                  <div className="font-semibold">{formatDate(m.joinDate)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-dim">Expires</div>
                  <div className="font-semibold">
                    {formatDate(m.subscriptionEnd)}
                    {m.status === "pending" && (
                      <span className="ml-2 text-warning text-xs">({daysLeft}d left)</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-dim">Lifetime Spend</div>
                  <div className="font-semibold text-accent">{formatPKR(m.totalSpent)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-dim">Loyalty Tokens</div>
                  <div className="font-semibold text-accent text-lg leading-none">
                    🪙 {m.loyaltyTokens}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={doCheckIn} disabled={m.status === "expired" || m.status === "frozen"}>
              🎯 Check-in
            </Button>
            <Button variant="secondary" onClick={() => setShowPlanModal(true)}>
              💳 Assign Plan
            </Button>
            <Button variant="secondary" onClick={() => setShowItemModal(true)}>
              🛒 Sell Item
            </Button>
            <Button variant="ghost" onClick={showQr}>
              📱 QR
            </Button>
            {can(currentUser, "member.edit") && (
              <Button variant="ghost" onClick={startEdit}>
                ✏️ Edit
              </Button>
            )}
            {m.status === "frozen" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  unfreezeMember(m.id);
                  logAction("member.unfreeze", { id: m.id });
                }}
              >
                Unfreeze
              </Button>
            ) : can(currentUser, "member.freeze") ? (
              <Button
                variant="secondary"
                onClick={() => {
                  freezeMember(m.id);
                  logAction("member.freeze", { id: m.id });
                }}
              >
                Freeze
              </Button>
            ) : null}
            {can(currentUser, "member.delete") && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-app">
        {(["overview", "trophies", "transactions", "attendance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-2 text-sm font-semibold capitalize transition border-b-2 " +
              (tab === t
                ? "text-accent border-accent"
                : "text-muted border-transparent hover:text-primary")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h2 className="font-bold text-lg mb-4">Personal Info</h2>
            <dl className="space-y-2 text-sm">
              <Info label="CNIC" value={m.cnic} />
              <Info label="Gender" value={m.gender} />
              <Info label="Address" value={m.address} />
              <Info label="Notes" value={m.notes} />
            </dl>
          </Card>
          <Card>
            <h2 className="font-bold text-lg mb-4">Emergency Contact</h2>
            <dl className="space-y-2 text-sm">
              <Info label="Name" value={m.emergencyContactName} />
              <Info label="Phone" value={m.emergencyContactPhone} />
            </dl>
            <h2 className="font-bold text-lg mt-6 mb-4">Subscription</h2>
            <dl className="space-y-2 text-sm">
              <Info label="Plan" value={plan?.name} />
              <Info label="Duration" value={plan ? `${plan.durationDays} days` : null} />
              <Info label="Start" value={formatDate(m.subscriptionStart)} />
              <Info label="End" value={formatDate(m.subscriptionEnd)} />
              <Info
                label="Frozen"
                value={m.frozenSince ? `Since ${formatDate(m.frozenSince)}` : "No"}
              />
            </dl>
          </Card>
        </div>
      )}

      {tab === "trophies" && (
        <div>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">Trophy Cabinet</h2>
                <p className="text-muted text-sm">
                  Milestones, memberships, and purchases earned by this m.
                </p>
              </div>
              <Badge variant="superuser">{m.achievements?.length || 0} trophies</Badge>
            </div>
            {!m.achievements?.length ? (
              <EmptyState
                icon="🏆"
                title="No trophies yet"
                description="Trophies are awarded when a member joins, purchases plans, buys items, and hits spending milestones."
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {m.achievements.map((a) => (
                  <div key={a.id} className="trophy" title={a.description}>
                    <div className="trophy-icon">{a.icon}</div>
                    <div className="text-xs font-bold text-primary leading-tight">{a.title}</div>
                    <div className="text-[10px] text-dim">{formatDate(a.awardedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <Card>
          <h2 className="font-bold text-lg mb-4">Transaction History</h2>
          {memberTxs.length === 0 ? (
            <EmptyState icon="💳" title="No transactions yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Note</th>
                    <th>Amount</th>
                    <th>Tokens</th>
                    <th>Paid via</th>
                  </tr>
                </thead>
                <tbody>
                  {memberTxs.map((t) => {
                    const p = t.planId ? d.plans.find((x) => x.id === t.planId)?.name : null;
                    const i = t.itemId ? d.inventory.find((x) => x.id === t.itemId)?.name : null;
                    return (
                      <tr key={t.id}>
                        <td className="text-muted text-xs">{formatDateTime(t.createdAt)}</td>
                        <td>
                          <Badge variant={t.type.includes("redeem") || t.type === "expense" ? "frozen" : t.type.startsWith("membership") ? "active" : "pending"}>
                            {t.type.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="text-sm">{t.note || p || i || "—"}</td>
                        <td
                          className={
                            "font-semibold " +
                            (t.amount < 0 ? "text-danger" : t.amount > 0 ? "text-accent" : "text-dim")
                          }
                        >
                          {t.amount === 0 ? "—" : formatPKR(Math.abs(t.amount))}
                        </td>
                        <td
                          className={
                            "font-mono text-sm " +
                            (t.tokensDelta < 0 ? "text-danger" : t.tokensDelta > 0 ? "text-accent" : "text-dim")
                          }
                        >
                          {t.tokensDelta > 0 ? "+" : ""}
                          {t.tokensDelta}
                        </td>
                        <td className="text-muted text-xs">
                          {t.paidWithTokens ? "🪙 Tokens" : "Cash/Card"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "attendance" && (
        <Card>
          <h2 className="font-bold text-lg mb-4">Attendance History ({memberAttendance.length})</h2>
          {memberAttendance.length === 0 ? (
            <EmptyState icon="✅" title="No check-ins yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Method</th>
                    <th>Processed by</th>
                  </tr>
                </thead>
                <tbody>
                  {memberAttendance.map((a) => {
                    const op = d.users.find((u) => u.id === a.checkedInBy);
                    return (
                      <tr key={a.id}>
                        <td className="text-sm">{formatDateTime(a.checkedInAt)}</td>
                        <td>
                          <Badge variant={a.method === "qr" ? "active" : "pending"}>{a.method}</Badge>
                        </td>
                        <td className="text-muted text-sm">{op?.displayName || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Assign plan modal */}
      <Modal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="Assign Subscription Plan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPlanModal(false)}>
              Cancel
            </Button>
            <Button onClick={assignPlan} disabled={!selectedPlanId}>
              Confirm & Process
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {actionError}
            </div>
          )}
          <div>
            <Label>Select Plan</Label>
            <Select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
              <option value="">— Select a plan —</option>
              {d.plans.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.durationDays}d — {formatPKR(p.price)} ({p.tokenGrant} tokens)
                </option>
              ))}
            </Select>
            {d.plans.length === 0 && (
              <p className="text-xs text-muted mt-2">
                No plans defined yet. Ask the superuser to create subscription plans.
              </p>
            )}
          </div>
          <div>
            <Label>Payment method</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  "flex-1 p-3 rounded-lg border text-sm font-semibold transition " +
                  (!planPaidWithTokens
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-accent"
                    : "border-app bg-surface-2 text-muted")
                }
                onClick={() => setPlanPaidWithTokens(false)}
              >
                💵 Cash/Card ({formatPKR(selectedPlanId ? d.plans.find(p => p.id === selectedPlanId)?.price ?? 0 : 0)})
              </button>
              <button
                type="button"
                className={
                  "flex-1 p-3 rounded-lg border text-sm font-semibold transition " +
                  (planPaidWithTokens
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-accent"
                    : "border-app bg-surface-2 text-muted")
                }
                onClick={() => setPlanPaidWithTokens(true)}
              >
                🪙 Loyalty Tokens
                {selectedPlanId && (
                  <div className="text-xs font-normal">
                    ({d.plans.find(p => p.id === selectedPlanId)?.price} tokens needed)
                  </div>
                )}
              </button>
            </div>
            {planPaidWithTokens && (
              <p className="text-xs text-warning mt-2">
                Note: token redemptions do NOT earn new loyalty tokens.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Sell item modal */}
      <Modal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        title="Sell Inventory Item"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowItemModal(false)}>
              Cancel
            </Button>
            <Button onClick={buyItem} disabled={!selectedItemId}>
              Process Sale
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {actionError}
            </div>
          )}
          <div>
            <Label>Item</Label>
            <Select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
              <option value="">— Select an item —</option>
              {d.inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {formatPKR(i.price)} — Stock: {i.stockQty}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={itemQty}
              onChange={(e) => setItemQty(Math.max(1, Number(e.target.value)))}
            />
          </div>
          {selectedItemId && d.inventory.find((i) => i.id === selectedItemId)?.isRedeemable && (
            <div>
              <Label>Payment Method</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={
                    "flex-1 p-3 rounded-lg border text-sm font-semibold " +
                    (!itemPaidWithTokens
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-accent"
                      : "border-app bg-surface-2 text-muted")
                  }
                  onClick={() => setItemPaidWithTokens(false)}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  className={
                    "flex-1 p-3 rounded-lg border text-sm font-semibold " +
                    (itemPaidWithTokens
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-accent"
                      : "border-app bg-surface-2 text-muted")
                  }
                  onClick={() => setItemPaidWithTokens(true)}
                >
                  🪙 Tokens ({d.inventory.find(i => i.id === selectedItemId)?.redemptionCost} each)
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </>
        }
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "fullName", label: "Full Name" },
            { k: "phone", label: "Phone" },
            { k: "email", label: "Email" },
            { k: "cnic", label: "CNIC" },
            { k: "emergencyContactName", label: "Emergency Name" },
            { k: "emergencyContactPhone", label: "Emergency Phone" },
          ].map((f) => (
            <div key={f.k}>
              <Label>{f.label}</Label>
              <Input
                value={editForm[f.k] || ""}
                onChange={(e) => setEditForm({ ...editForm, [f.k]: e.target.value })}
              />
            </div>
          ))}
          <div className="col-span-2">
            <Label>Address</Label>
            <Input
              value={editForm.address || ""}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <textarea
              className="input"
              rows={3}
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* QR modal */}
      <Modal open={!!qrUrl} onClose={() => setQrUrl(null)} title={`Member QR — ${m.uid}`}>
        <div className="text-center">
          {qrUrl && (
            <>
              <img src={qrUrl} className="mx-auto rounded-lg border border-app p-2" alt="QR" />
              <p className="text-xs font-mono text-muted mt-3">gym://checkin/{m.uid}</p>
              <Button
                className="mt-4"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrUrl;
                  a.download = `${m.uid}-qr.png`;
                  a.click();
                }}
              >
                Download ID card QR
              </Button>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this member?"
        message="This permanently removes all their records. This action is logged."
        danger
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteMember(m.id);
          logAction("member.delete", { id: m.id });
          router.push("/dashboard/members");
        }}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-app last:border-0">
      <dt className="text-dim uppercase tracking-wider text-xs">{label}</dt>
      <dd className="text-right">{value || <span className="text-dim">—</span>}</dd>
    </div>
  );
}
