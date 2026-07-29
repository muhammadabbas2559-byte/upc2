"use client";
import { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import {
  Button,
  Card,
  Input,
  Label,
  Modal,
  Select,
  Badge,
  EmptyState,
} from "@/components/ui";
import { formatPKR, formatDate } from "@/lib/utils";
import { summarize } from "@/lib/finance";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { exportFinancePdf, exportFinanceDocx, exportMemberListCsv } from "@/lib/export";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

const PIE_COLORS = ["#FF6B00", "#FF8C00", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ef4444"];

export default function FinancesPage() {
  const { db, addExpense } = useData();
  const { currentUser } = useAuth();
  const [showExpense, setShowExpense] = useState(false);
  const [exp, setExp] = useState({ name: "", amount: 0, category: "utilities", description: "", date: "" });

  if (!db) return null;
  const s = useMemo(() => summarize(db), [db]);
  const isAdmin = can(currentUser, "finance.view");

  async function handleExpense(e: React.FormEvent) {
    e.preventDefault();
    await addExpense({
      name: exp.name,
      amount: exp.amount,
      category: exp.category,
      description: exp.description,
      date: exp.date || undefined,
    });
    logAction("expense.create", { name: exp.name, amount: exp.amount });
    setShowExpense(false);
    setExp({ name: "", amount: 0, category: "utilities", description: "", date: "" });
  }

  const pieData = s.revenueByCategory.map((r) => ({
    name: r.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: r.total,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Financial Analytics</h1>
          <p className="text-muted mt-1">
            Revenue, expenses, and profit · All values in PKR. 100% offline data.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {can(currentUser, "expense.create") && (
            <Button variant="secondary" onClick={() => setShowExpense(true)}>
              🧾 Record Expense
            </Button>
          )}
          {isAdmin && (
            <>
              <Button variant="secondary" onClick={() => { exportFinancePdf(db); logAction("export", { format: "pdf" }); }}>
                📄 Export PDF
              </Button>
              <Button variant="secondary" onClick={() => { exportFinanceDocx(db); logAction("export", { format: "docx" }); }}>
                📝 Export Word
              </Button>
              <Button variant="ghost" onClick={() => exportMemberListCsv(db)}>
                📊 Members CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {!isAdmin ? (
        <Card>
          <EmptyState
            icon="🔒"
            title="Financial analytics is superuser-only"
            description="You have permission to record expenses but full analytics and exports are restricted to the superuser."
          />
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="metric-card">
              <div className="metric-icon">💰</div>
              <div className="mt-4 text-xs text-muted uppercase tracking-wider font-semibold">Total Revenue</div>
              <div className="text-2xl font-black mt-1">{formatPKR(s.totalRevenue)}</div>
              <div className="text-xs text-muted mt-1">{formatPKR(s.revenueThisMonth)} this month</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{background: "rgba(239,68,68,0.15)", color: "#ef4444"}}>💸</div>
              <div className="mt-4 text-xs text-muted uppercase tracking-wider font-semibold">Total Expenses</div>
              <div className="text-2xl font-black mt-1">{formatPKR(s.totalExpenses)}</div>
              <div className="text-xs text-muted mt-1">{formatPKR(s.expensesThisMonth)} this month</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{background: s.netProfit >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: s.netProfit >= 0 ? "#22c55e" : "#ef4444"}}>
                {s.netProfit >= 0 ? "📈" : "📉"}
              </div>
              <div className="mt-4 text-xs text-muted uppercase tracking-wider font-semibold">Net Profit</div>
              <div className={"text-2xl font-black mt-1 " + (s.netProfit >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]")}>
                {formatPKR(s.netProfit)}
              </div>
              <div className="text-xs text-muted mt-1">{formatPKR(s.profitThisMonth)} this month</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">🏦</div>
              <div className="mt-4 text-xs text-muted uppercase tracking-wider font-semibold">Margin</div>
              <div className="text-2xl font-black mt-1">
                {s.totalRevenue > 0 ? `${Math.round((s.netProfit / s.totalRevenue) * 100)}%` : "—"}
              </div>
              <div className="text-xs text-muted mt-1">All-time</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <h2 className="font-bold text-lg mb-4">Monthly Income vs Expenses (PKR)</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.monthly}>
                    <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#a0a0a0" />
                    <YAxis stroke="#a0a0a0" />
                    <Tooltip
                      contentStyle={{ background: "#171717", border: "1px solid #3a3a3a", borderRadius: 8 }}
                      formatter={(v) => formatPKR(Number(v))}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="income" name="Income" stroke="#FF6B00" strokeWidth={3} dot={{ r: 4, fill: "#FF6B00" }} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h2 className="font-bold text-lg mb-4">Revenue by Category</h2>
              <div className="h-72">
                {pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted text-sm">No revenue yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={40}
                        paddingAngle={3}
                        label={(entry) => entry.name}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0d0d0d" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#171717", border: "1px solid #3a3a3a", borderRadius: 8 }}
                        formatter={(v) => formatPKR(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="font-bold text-lg mb-4">Recent Expenses</h2>
            {db.expenses.length === 0 ? (
              <p className="text-muted text-sm py-6 text-center">No expenses recorded.</p>
            ) : (
              <div className="overflow-x-auto -mx-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...db.expenses]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 30)
                      .map((e) => (
                        <tr key={e.id}>
                          <td className="text-muted text-sm">{formatDate(e.date)}</td>
                          <td className="font-semibold">{e.name}</td>
                          <td><Badge variant="pending">{e.category}</Badge></td>
                          <td className="text-danger font-semibold">{formatPKR(e.amount)}</td>
                          <td className="text-muted text-sm">{e.description || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal
        open={showExpense}
        onClose={() => setShowExpense(false)}
        title="Record Expense"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowExpense(false)}>Cancel</Button>
            <Button type="submit" form="exp-form">Save Expense</Button>
          </>
        }
      >
        <form id="exp-form" onSubmit={handleExpense} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input required value={exp.name} onChange={(e) => setExp({ ...exp, name: e.target.value })} placeholder="e.g. Electricity bill" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (PKR)</Label>
              <Input type="number" min={0} required value={exp.amount || ""} onChange={(e) => setExp({ ...exp, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
                <option value="utilities">Utilities</option>
                <option value="rent">Rent</option>
                <option value="salaries">Salaries</option>
                <option value="equipment">Equipment</option>
                <option value="supplies">Supplies</option>
                <option value="marketing">Marketing</option>
                <option value="maintenance">Maintenance</option>
                <option value="taxes">Taxes</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={exp.date ? exp.date.slice(0, 10) : ""} onChange={(e) => setExp({ ...exp, date: new Date(e.target.value).toISOString() })} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea className="input" rows={2} value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
