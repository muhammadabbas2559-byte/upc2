"use client";
import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Button, Card, Input, Label, Modal, Select, Badge, EmptyState, ConfirmDialog } from "@/components/ui";
import { formatPKR } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

export default function InventoryPage() {
  const { db, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useData();
  const { currentUser } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    image: "",
    category: "supplements",
    stockQty: 0,
    lowStockThreshold: 3,
    price: 0,
    tokenValue: 0,
    isRedeemable: false,
    redemptionCost: 0,
  });

  const isAdmin = can(currentUser, "inventory.create");
  if (!db) return null;

  function resetForm() {
    setForm({
      name: "",
      description: "",
      image: "",
      category: "supplements",
      stockQty: 0,
      lowStockThreshold: 3,
      price: 0,
      tokenValue: 0,
      isRedeemable: false,
      redemptionCost: 0,
    });
  }

  function openNew() {
    resetForm();
    setEditId(null);
    setShowNew(true);
  }
  function openEdit(id: string) {
    const it = db!.inventory.find((i) => i.id === id);
    if (!it) return;
    setForm({
      name: it.name,
      description: it.description || "",
      image: it.image || "",
      category: it.category || "",
      stockQty: it.stockQty,
      lowStockThreshold: it.lowStockThreshold,
      price: it.price,
      tokenValue: it.tokenValue,
      isRedeemable: it.isRedeemable,
      redemptionCost: it.redemptionCost || 0,
    });
    setEditId(id);
    setShowNew(true);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      window.alert("Please choose an image smaller than 2 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, image: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await updateInventoryItem(editId, form);
      logAction("inventory.edit", { id: editId });
    } else {
      await addInventoryItem(form);
      logAction("inventory.create", { name: form.name });
    }
    setShowNew(false);
    resetForm();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Inventory</h1>
          <p className="text-muted mt-1">
            Manage store items, pricing, stock and loyalty token values.
          </p>
        </div>
        {isAdmin && <Button onClick={openNew}>➕ Add Item</Button>}
      </div>

      <Card>
        {db.inventory.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No inventory items yet"
            description={isAdmin ? "Add your first item to start selling and rewarding tokens." : "Ask an admin to add inventory items."}
            action={isAdmin ? <Button onClick={openNew}>Add First Item</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Tokens Earned</th>
                  <th>Token Cost</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {db.inventory.map((i) => {
                  const low = i.stockQty <= i.lowStockThreshold;
                  return (
                    <tr key={i.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          {i.image ? (
                            <img src={i.image} alt="" className="h-10 w-10 rounded-lg object-cover border border-app" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-surface-2 border border-app flex items-center justify-center">📦</div>
                          )}
                          <div>
                            <div className="font-semibold">{i.name}</div>
                            {i.description && (
                              <div className="text-xs text-muted">{i.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-muted text-sm">{i.category || "—"}</td>
                      <td>
                        <span className={low ? "text-danger font-bold" : ""}>
                          {i.stockQty}
                        </span>
                        {low && (
                          <Badge variant="expired">Low</Badge>
                        )}
                      </td>
                      <td className="font-semibold text-accent">{formatPKR(i.price)}</td>
                      <td className="font-mono text-sm">🪙 {i.tokenValue}</td>
                      <td className="font-mono text-sm">
                        {i.isRedeemable ? `🪙 ${i.redemptionCost}` : <span className="text-dim">—</span>}
                      </td>
                      <td className="text-right">
                        {isAdmin ? (
                          <div className="inline-flex gap-1">
                            <button className="btn btn-ghost !py-1.5 !px-2 !text-xs" onClick={() => openEdit(i.id)}>
                              Edit
                            </button>
                            <button
                              className="btn btn-danger !py-1.5 !px-2 !text-xs"
                              onClick={() => setConfirmDelete(i.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-dim text-xs">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title={editId ? "Edit Item" : "Add Inventory Item"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button type="submit" form="inv-form">
              {editId ? "Save" : "Add Item"}
            </Button>
          </>
        }
        size="lg"
      >
        <form id="inv-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Item Image (optional)</Label>
              <Input type="file" accept="image/*" onChange={handleImageChange} />
              {form.image && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={form.image} alt="Item preview" className="h-16 w-16 rounded-lg object-cover border border-app" />
                  <button type="button" className="text-xs text-danger" onClick={() => setForm({ ...form, image: "" })}>
                    Remove image
                  </button>
                </div>
              )}
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
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="supplements, apparel, gear..."
              />
            </div>
            <div>
              <Label>Price (PKR)</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Stock Qty</Label>
              <Input
                type="number"
                min={0}
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Low-stock threshold</Label>
              <Input
                type="number"
                min={0}
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Tokens earned on purchase</Label>
              <Input
                type="number"
                min={0}
                value={form.tokenValue}
                onChange={(e) => setForm({ ...form, tokenValue: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Redeemable with tokens?</Label>
              <Select
                value={form.isRedeemable ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, isRedeemable: e.target.value === "yes" })}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
            {form.isRedeemable && (
              <div>
                <Label>Token cost per unit</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.redemptionCost}
                  onChange={(e) => setForm({ ...form, redemptionCost: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            Remember: when members pay with tokens, no new tokens are granted for that purchase.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete inventory item?"
        message="This removes the item permanently. Existing transaction history is preserved."
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteInventoryItem(confirmDelete);
            logAction("inventory.delete", { id: confirmDelete });
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
