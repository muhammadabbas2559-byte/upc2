/**
 * Financial calculations: revenue, expenses, P&L, monthly rollups for charts.
 */
import type { Database, Transaction, Expense } from "./schema";

export interface MonthlyPoint {
  month: string; // "YYYY-MM"
  label: string; // "Jan 25"
  income: number;
  expenses: number;
  profit: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueThisMonth: number;
  expensesThisMonth: number;
  profitThisMonth: number;
  activeMembersCount: number;
  todayAttendance: number;
  pendingRenewals: number;
  lowStockCount: number;
  monthly: MonthlyPoint[];
  revenueByCategory: { category: string; total: number }[];
}

function monthKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
}

export function summarize(db: Database): FinanceSummary {
  const now = new Date();
  const thisMonth = monthKey(now);
  let totalRevenue = 0;
  let totalExpenses = 0;
  let revenueThisMonth = 0;
  let expensesThisMonth = 0;

  const bucket: Record<string, { income: number; expenses: number }> = {};
  // Expenses are written to both `expenses` and `transactions` for history.
  // Keep the IDs so they are counted once in the P&L.
  const expenseIds = new Set(db.expenses.map((expense) => expense.id));
  const categoryTotals: Record<string, number> = {};

  const ensureBucket = (mk: string) => {
    if (!bucket[mk]) bucket[mk] = { income: 0, expenses: 0 };
    return bucket[mk];
  };

  for (const t of db.transactions) {
    if (t.type === "expense") {
      // addExpense stores a matching transaction and expense record. The
      // dedicated expense record is authoritative, so skip its transaction.
      if (expenseIds.has(t.id)) continue;
      totalExpenses += Math.abs(t.amount);
      const mk = monthKey(t.createdAt);
      ensureBucket(mk).expenses += Math.abs(t.amount);
      if (mk === thisMonth) expensesThisMonth += Math.abs(t.amount);
    } else {
      totalRevenue += Math.max(0, t.amount);
      const mk = monthKey(t.createdAt);
      ensureBucket(mk).income += Math.max(0, t.amount);
      if (mk === thisMonth) revenueThisMonth += Math.max(0, t.amount);
      const cat = t.type;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.max(0, t.amount);
    }
  }
  for (const e of db.expenses) {
    totalExpenses += e.amount;
    const mk = monthKey(e.date);
    ensureBucket(mk).expenses += e.amount;
    if (mk === thisMonth) expensesThisMonth += e.amount;
  }

  // Attendance today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayAttendance = db.attendance.filter(
    (a) => new Date(a.checkedInAt) >= todayStart
  ).length;

  const activeMembersCount = db.members.filter((m) => m.status === "active").length;

  // Pending renewals (expiring within 7 days or already expired but not frozen)
  const warnDays = db.settings.subscriptionExpiryWarningDays;
  const pendingRenewals = db.members.filter((m) => {
    if (!m.subscriptionEnd) return false;
    const left = Math.ceil(
      (new Date(m.subscriptionEnd).getTime() - now.getTime()) / 86_400_000
    );
    return m.status === "active" && left <= warnDays;
  }).length;

  const lowStockCount = db.inventory.filter(
    (i) => i.stockQty <= i.lowStockThreshold
  ).length;

  // Sort monthly buckets ascending
  const months = Object.keys(bucket).sort();
  const monthly: MonthlyPoint[] = months.map((mk) => ({
    month: mk,
    label: monthLabel(mk),
    income: bucket[mk].income,
    expenses: bucket[mk].expenses,
    profit: bucket[mk].income - bucket[mk].expenses,
  }));

  const revenueByCategory = Object.entries(categoryTotals).map(([category, total]) => ({
    category,
    total,
  }));

  return {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    revenueThisMonth,
    expensesThisMonth,
    profitThisMonth: revenueThisMonth - expensesThisMonth,
    activeMembersCount,
    todayAttendance,
    pendingRenewals,
    lowStockCount,
    monthly,
    revenueByCategory,
  };
}

export function addExpenseTx(
  db: Database,
  opts: {
    name: string;
    amount: number;
    category: string;
    date?: string;
    description?: string;
    userId: string;
  }
): Transaction {
  const tx: Transaction = {
    id: Math.random().toString(36).slice(2),
    type: "expense",
    amount: -Math.abs(opts.amount),
    tokensDelta: 0,
    userId: opts.userId,
    note: opts.name + (opts.description ? ` — ${opts.description}` : ""),
    expenseCategory: opts.category,
    paidWithTokens: false,
    createdAt: opts.date || new Date().toISOString(),
  };
  const expense: Expense = {
    id: tx.id,
    name: opts.name,
    description: opts.description,
    amount: Math.abs(opts.amount),
    category: opts.category,
    date: opts.date || new Date().toISOString(),
    createdBy: opts.userId,
  };
  db.transactions.push(tx);
  db.expenses.push(expense);
  return tx;
}
