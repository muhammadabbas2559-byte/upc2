"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import * as db from "@/lib/db";
import type {
  Database,
  Member,
  InventoryItem,
  SubscriptionPlan,
  Transaction,
  AttendanceRecord,
  Notification,
  SystemSettings,
  Expense,
} from "@/lib/schema";
import { useAuth } from "./AuthContext";

interface DataContextValue {
  db: Database | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  // Members
  addMember: (m: Omit<Member, "id" | "uid" | "loyaltyTokens" | "totalSpent" | "achievements" | "joinDate" | "status">) => Promise<Member>;
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  freezeMember: (id: string) => Promise<void>;
  unfreezeMember: (id: string) => Promise<void>;
  checkIn: (memberId: string, method?: "manual" | "qr") => Promise<void>;
  // Inventory
  addInventoryItem: (i: Omit<InventoryItem, "id" | "createdAt">) => Promise<InventoryItem>;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  // Plans
  addPlan: (p: Omit<SubscriptionPlan, "id" | "createdAt" | "active">) => Promise<SubscriptionPlan>;
  updatePlan: (id: string, patch: Partial<SubscriptionPlan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  // Transactions
  recordPurchase: (tx: {
    type: "membership_purchase" | "membership_renewal" | "membership_upgrade" | "item_purchase";
    memberId: string;
    itemId?: string;
    planId?: string;
    quantity?: number;
    paidWithTokens: boolean;
    note?: string;
  }) => Promise<Transaction>;
  redeemItemWithTokens: (memberId: string, itemId: string, quantity: number) => Promise<Transaction>;
  addExpense: (e: { name: string; description?: string; amount: number; category: string; date?: string }) => Promise<void>;
  // Settings
  updateSettings: (patch: Partial<SystemSettings>) => Promise<void>;
  // Notifications
  markNotificationRead: (id: string) => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
}

const DataCtx = createContext<DataContextValue | null>(null);

function computeDerivedStatus(member: Member, settings: SystemSettings): Member {
  const m = { ...member };
  if (m.frozenSince) {
    m.status = "frozen";
    return m;
  }
  if (m.subscriptionEnd) {
    const end = new Date(m.subscriptionEnd).getTime();
    const now = Date.now();
    if (end < now) m.status = "expired";
    else if (end - now <= settings.subscriptionExpiryWarningDays * 86_400_000)
      m.status = "pending";
    else m.status = "active";
  } else if (m.status === "pending" || !m.status) {
    m.status = "pending";
  }
  return m;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [snapshot, setSnapshot] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      const instance = db.getDb();
      // Recompute derived member statuses
      const members = instance.members.map((m) => computeDerivedStatus(m, instance.settings));
      setSnapshot({ ...instance, members });
      setError(null);
    } catch (err) {
      console.error("DataProvider reload failed:", err);
      setSnapshot(null);
      setError((err as Error).message);
      // Do NOT redirect here — let Gate (the single auth source of truth) handle redirects.
      // Redirecting on any error silently swallows the real problem.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setSnapshot(null);
      setLoading(true);
      return;
    }
    reload();
  }, [currentUser, reload]);

  // Auto-recompute notifications based on state
  const refreshNotifications = useCallback(async () => {
    if (!snapshot) return;
    const warnings: Notification[] = [];
    const existingIds = new Set(snapshot.notifications.map((n) => n.id));

    // Expiring subscriptions
    for (const m of snapshot.members) {
      if (!m.subscriptionEnd || m.status === "frozen") continue;
      const daysLeft = Math.ceil(
        (new Date(m.subscriptionEnd).getTime() - Date.now()) / 86_400_000
      );
      if (daysLeft >= 0 && daysLeft <= snapshot.settings.subscriptionExpiryWarningDays) {
        const id = `expiring-${m.id}`;
        if (!existingIds.has(id)) {
          warnings.push({
            id,
            title: `Subscription ending soon: ${m.fullName}`,
            body: `${m.fullName}'s membership expires in ${daysLeft} day(s).`,
            level: daysLeft <= 2 ? "danger" : "warning",
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    // Low stock
    for (const i of snapshot.inventory) {
      if (i.stockQty <= i.lowStockThreshold) {
        const id = `lowstock-${i.id}`;
        if (!existingIds.has(id)) {
          warnings.push({
            id,
            title: `Low stock: ${i.name}`,
            body: `Only ${i.stockQty} unit(s) remaining (threshold: ${i.lowStockThreshold}).`,
            level: i.stockQty === 0 ? "danger" : "warning",
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    if (warnings.length) {
      await db.mutate((d) => {
        d.notifications = [...d.notifications, ...warnings];
      });
    }
  }, [snapshot]);

  useEffect(() => {
    if (snapshot) refreshNotifications();
  }, [snapshot, refreshNotifications]);

  // ------------ MUTATIONS ------------
  const addMember: DataContextValue["addMember"] = async (input) => {
    const newMember: Member = {
      id: Math.random().toString(36).slice(2),
      uid: "GF-" + Math.floor(Math.random() * 36 ** 7).toString(36).toUpperCase().padStart(7, "0"),
      fullName: input.fullName,
      cnic: input.cnic,
      phone: input.phone,
      email: input.email,
      address: input.address,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      gender: input.gender,
      dob: input.dob,
      joinDate: new Date().toISOString(),
      photo: input.photo,
      status: "pending",
      subscriptionId: input.subscriptionId,
      subscriptionStart: input.subscriptionStart,
      subscriptionEnd: input.subscriptionEnd,
      loyaltyTokens: 0,
      totalSpent: 0,
      notes: input.notes,
      achievements: [
        {
          id: Math.random().toString(36).slice(2),
          type: "milestone",
          title: "Welcome to the Pack",
          description: "Joined Obsidian Gym Manager",
          icon: "🎉",
          awardedAt: new Date().toISOString(),
        },
      ],
    };
    await db.mutate((d) => {
      d.members.push(newMember);
    });
    reload();
    return newMember;
  };

  const updateMember: DataContextValue["updateMember"] = async (id, patch) => {
    await db.mutate((d) => {
      const m = d.members.find((x) => x.id === id);
      if (!m) return;
      Object.assign(m, patch);
    });
    reload();
  };

  const deleteMember: DataContextValue["deleteMember"] = async (id) => {
    await db.mutate((d) => {
      d.members = d.members.filter((m) => m.id !== id);
      d.transactions = d.transactions.filter((t) => t.memberId !== id);
      d.attendance = d.attendance.filter((a) => a.memberId !== id);
    });
    reload();
  };

  const freezeMember: DataContextValue["freezeMember"] = async (id) => {
    await db.mutate((d) => {
      const m = d.members.find((x) => x.id === id);
      if (m) m.frozenSince = new Date().toISOString();
    });
    reload();
  };
  const unfreezeMember: DataContextValue["unfreezeMember"] = async (id) => {
    await db.mutate((d) => {
      const m = d.members.find((x) => x.id === id);
      if (!m) return;
      // Shift subscription end by frozen duration
      if (m.frozenSince && m.subscriptionEnd) {
        const frozenMs = Date.now() - new Date(m.frozenSince).getTime();
        m.subscriptionEnd = new Date(new Date(m.subscriptionEnd).getTime() + frozenMs).toISOString();
      }
      m.frozenSince = undefined;
    });
    reload();
  };

  const checkIn: DataContextValue["checkIn"] = async (memberId, method = "manual") => {
    const d = db.getDb();
    const member = d.members.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");
    if (member.status === "expired") throw new Error("Membership is expired");
    const record: AttendanceRecord = {
      id: Math.random().toString(36).slice(2),
      memberId,
      memberName: member.fullName,
      checkedInAt: new Date().toISOString(),
      checkedInBy: db.getCurrentUser()!.id,
      method,
    };
    await db.mutate((dx) => {
      dx.attendance.push(record);
    });
    reload();
  };

  const addInventoryItem: DataContextValue["addInventoryItem"] = async (i) => {
    const item: InventoryItem = {
      ...i,
      id: Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
    };
    await db.mutate((d) => {
      d.inventory.push(item);
    });
    reload();
    return item;
  };
  const updateInventoryItem: DataContextValue["updateInventoryItem"] = async (id, patch) => {
    await db.mutate((d) => {
      const item = d.inventory.find((i) => i.id === id);
      if (item) Object.assign(item, patch);
    });
    reload();
  };
  const deleteInventoryItem: DataContextValue["deleteInventoryItem"] = async (id) => {
    await db.mutate((d) => {
      d.inventory = d.inventory.filter((i) => i.id !== id);
    });
    reload();
  };

  const addPlan: DataContextValue["addPlan"] = async (p) => {
    const plan: SubscriptionPlan = {
      ...p,
      id: Math.random().toString(36).slice(2),
      active: true,
      createdAt: new Date().toISOString(),
    };
    await db.mutate((d) => {
      d.plans.push(plan);
    });
    reload();
    return plan;
  };
  const updatePlan: DataContextValue["updatePlan"] = async (id, patch) => {
    await db.mutate((d) => {
      const p = d.plans.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
    reload();
  };
  const deletePlan: DataContextValue["deletePlan"] = async (id) => {
    await db.mutate((d) => {
      d.plans = d.plans.filter((p) => p.id !== id);
    });
    reload();
  };

  const recordPurchase: DataContextValue["recordPurchase"] = async ({
    type, memberId, itemId, planId, quantity = 1, paidWithTokens, note,
  }) => {
    const d = db.getDb();
    const member = d.members.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");

    let amount = 0;
    let tokensDelta = 0;
    let plan: SubscriptionPlan | undefined;
    let item: InventoryItem | undefined;
    const achievements: Member["achievements"] = [];

    if (planId) {
      plan = d.plans.find((p) => p.id === planId);
      if (!plan) throw new Error("Plan not found");
      amount = plan.price;
      tokensDelta = paidWithTokens ? 0 : plan.tokenGrant;
    } else if (itemId) {
      item = d.inventory.find((i) => i.id === itemId);
      if (!item) throw new Error("Item not found");
      if (item.stockQty < quantity) throw new Error("Insufficient stock");
      amount = item.price * quantity;
      tokensDelta = paidWithTokens ? 0 : item.tokenValue * quantity;
    }

    // If paying with tokens, deduct tokens from member (no new tokens granted)
    let finalTokensDelta = tokensDelta;
    if (paidWithTokens) {
      const needed = plan ? plan.price : (item?.redemptionCost ?? 0) * quantity;
      if (member.loyaltyTokens < needed)
        throw new Error(`Member only has ${member.loyaltyTokens} tokens, needs ${needed}`);
      finalTokensDelta = -needed;
    }

    const tx: Transaction = {
      id: Math.random().toString(36).slice(2),
      type,
      memberId,
      userId: db.getCurrentUser()!.id,
      amount: paidWithTokens ? 0 : amount,
      tokensDelta: finalTokensDelta,
      itemId,
      planId,
      note,
      paidWithTokens,
      createdAt: new Date().toISOString(),
    };

    await db.mutate((dx) => {
      dx.transactions.push(tx);
      const m = dx.members.find((x) => x.id === memberId)!;
      m.loyaltyTokens = Math.max(0, m.loyaltyTokens + finalTokensDelta);
      if (!paidWithTokens) m.totalSpent += amount;
      if (item) {
        const it = dx.inventory.find((i) => i.id === item!.id);
        if (it) it.stockQty = Math.max(0, it.stockQty - quantity);
      }
      if (plan) {
        m.subscriptionId = plan.id;
        const start = new Date();
        m.subscriptionStart = start.toISOString();
        m.subscriptionEnd = new Date(
          start.getTime() + plan.durationDays * 86_400_000
        ).toISOString();
        m.frozenSince = undefined;
        achievements.push({
          id: Math.random().toString(36).slice(2),
          type: "membership",
          title: `${plan.name} Member`,
          description: `Activated ${plan.name} for ${plan.durationDays} days`,
          icon: plan.tier === "vip" ? "👑" : plan.tier === "premium" ? "🥇" : "💳",
          awardedAt: new Date().toISOString(),
        });
      }
      if (item && !paidWithTokens) {
        achievements.push({
          id: Math.random().toString(36).slice(2),
          type: "purchase",
          title: `Purchased: ${item.name}`,
          icon: "🛒",
          awardedAt: new Date().toISOString(),
        });
      }
      m.achievements = [...(m.achievements ?? []), ...achievements];
    });
    reload();
    return tx;
  };

  const redeemItemWithTokens: DataContextValue["redeemItemWithTokens"] = async (memberId, itemId, quantity) => {
    const d = db.getDb();
    const item = d.inventory.find((i) => i.id === itemId);
    if (!item) throw new Error("Item not found");
    if (!item.isRedeemable) throw new Error("This item cannot be redeemed with tokens");
    if (item.stockQty < quantity) throw new Error("Insufficient stock");
    const member = d.members.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");
    const cost = (item.redemptionCost ?? 0) * quantity;
    if (member.loyaltyTokens < cost) throw new Error("Not enough tokens");
    const tx: Transaction = {
      id: Math.random().toString(36).slice(2),
      type: "item_redemption",
      memberId,
      userId: db.getCurrentUser()!.id,
      amount: 0,
      tokensDelta: -cost,
      itemId,
      paidWithTokens: true,
      note: `Redeemed ${quantity}x ${item.name}`,
      createdAt: new Date().toISOString(),
    };
    await db.mutate((dx) => {
      dx.transactions.push(tx);
      const m = dx.members.find((x) => x.id === memberId)!;
      m.loyaltyTokens -= cost;
      const it = dx.inventory.find((i) => i.id === itemId)!;
      it.stockQty -= quantity;
      m.achievements = [...(m.achievements ?? []), {
        id: Math.random().toString(36).slice(2),
        type: "purchase",
        title: `Redeemed: ${item.name}`,
        description: `Redeemed with ${cost} loyalty tokens`,
        icon: "🎁",
        awardedAt: new Date().toISOString(),
      }];
    });
    reload();
    return tx;
  };

  const addExpense: DataContextValue["addExpense"] = async (e) => {
    await db.mutate((dx) => {
      const exp: Expense = {
        id: Math.random().toString(36).slice(2),
        name: e.name,
        description: e.description,
        amount: e.amount,
        category: e.category,
        date: e.date || new Date().toISOString(),
        createdBy: db.getCurrentUser()!.id,
      };
      dx.expenses.push(exp);
      dx.transactions.push({
        id: exp.id,
        type: "expense",
        amount: -Math.abs(e.amount),
        tokensDelta: 0,
        userId: db.getCurrentUser()!.id,
        note: e.name + (e.description ? ` — ${e.description}` : ""),
        expenseCategory: e.category,
        paidWithTokens: false,
        createdAt: exp.date,
      });
    });
    reload();
  };

  const updateSettings: DataContextValue["updateSettings"] = async (patch) => {
    await db.mutate((d) => {
      d.settings = { ...d.settings, ...patch };
    });
    reload();
  };

  const markNotificationRead: DataContextValue["markNotificationRead"] = async (id) => {
    await db.mutate((d) => {
      const n = d.notifications.find((x) => x.id === id);
      if (n) n.read = true;
    });
    reload();
  };
  const dismissNotification: DataContextValue["dismissNotification"] = async (id) => {
    await db.mutate((d) => {
      d.notifications = d.notifications.filter((n) => n.id !== id);
    });
    reload();
  };

  return (
    <DataCtx.Provider
      value={{
        db: snapshot,
        loading,
        error,
        reload,
        addMember,
        updateMember,
        deleteMember,
        freezeMember,
        unfreezeMember,
        checkIn,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        addPlan,
        updatePlan,
        deletePlan,
        recordPurchase,
        redeemItemWithTokens,
        addExpense,
        updateSettings,
        markNotificationRead,
        dismissNotification,
      }}
    >
      {children}
    </DataCtx.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error("useData must be inside DataProvider");
  return ctx;
}
