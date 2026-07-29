"use client";
import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Button, Card, Input, Label, Modal, Select, Badge, EmptyState, ConfirmDialog } from "@/components/ui";
import { formatPKR } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

export default function SubscriptionsPage() {
  const { db, addPlan, updatePlan, deletePlan } = useData();
  const { currentUser } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationDays: 30,
    price: 0,
    tokenGrant: 0,
    tier: "basic" as "basic" | "premium" | "vip" | "custom",
  });

  if (!db) return null;
  const isAdmin = can(currentUser, "plan.create");

  function resetForm() {
    setForm({ name: "", description: "", durationDays: 30, price: 0, tokenGrant: 0, tier: "basic" });
  }
  function openNew() {
    resetForm();
    setEditId(null);
    setShowNew(true);
  }
  function openEdit(id: string) {
    const p = db!.plans.find((x) => x.id === id);
    if (!p) return;
    setForm({
      name: p.name,
      description: p.description || "",
      durationDays: p.durationDays,
      price: p.price,
      tokenGrant: p.tokenGrant,
      tier: p.tier,
    });
    setEditId(id);
    setShowNew(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await updatePlan(editId, form);
      logAction("plan.edit", { id: editId });
    } else {
      await addPlan(form);
      logAction("plan.create", { name: form.name });
    }
    setShowNew(false);
    resetForm();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Subscription Plans</h1>
          <p className="text-muted mt-1">
            Custom membership tiers, pricing, and loyalty token grants.
          </p>
        </div>
        {isAdmin && <Button onClick={openNew}>➕ New Plan</Button>}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {db.plans.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="⭐"
              title="No subscription plans"
              description={isAdmin ? "Create your first membership tier." : "Ask an admin to create plans."}
              action={isAdmin ? <Button onClick={openNew}>Create Plan</Button> : null}
            />
          </div>
        )}
        {db.plans.map((p) => (
          <Card key={p.id} className={p.active ? "card-accent" : ""}>
            <div className="flex items-start justify-between">
              <div>
                <Badge variant={p.tier === "vip" ? "superuser" : p.tier === "premium" ? "pending" : "active"}>
                  {p.tier}
                </Badge>
                <h3 className="text-xl font-bold mt-2">{p.name}</h3>
                {p.description && <p className="text-sm text-muted mt-1">{p.description}</p>}
              </div>
              {!p.active && <Badge variant="frozen">Inactive</Badge>}
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Duration</span>
                <span className="font-semibold">{p.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Price</span>
                <span className="font-bold text-accent text-lg">{formatPKR(p.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Token grant</span>
                <span className="font-mono">🪙 {p.tokenGrant}</span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-app">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(p.id)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => updatePlan(p.id, { active: !p.active })}>
                  {p.active ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(p.id)}>
                  🗑
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title={editId ? "Edit Plan" : "New Subscription Plan"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button type="submit" form="plan-form">
              {editId ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <form id="plan-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Plan Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 1-Month Basic" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <textarea
                className="input"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Tier</Label>
              <Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as never })}>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <Label>Duration (days)</Label>
              <Input
                type="number"
                min={1}
                required
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Price (PKR)</Label>
              <Input
                type="number"
                min={0}
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Tokens granted</Label>
              <Input
                type="number"
                min={0}
                value={form.tokenGrant}
                onChange={(e) => setForm({ ...form, tokenGrant: Number(e.target.value) })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete plan?"
        message="Existing members on this plan will keep their memberships, but no new subscriptions can use this plan."
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deletePlan(confirmDelete);
            logAction("plan.delete", { id: confirmDelete });
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
