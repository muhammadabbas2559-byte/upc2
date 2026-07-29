"use client";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import { Card, Badge } from "@/components/ui";
import { formatPKR, formatDate, daysUntil } from "@/lib/utils";
import { summarize } from "@/lib/finance";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

export default function DashboardPage() {
  const { db, loading } = useData();
  const { currentUser } = useAuth();

  if (loading || !db) return <div className="text-muted">Loading...</div>;
  const s = summarize(db);

  logAction("view.dashboard");

  const recentAttendance = [...db.attendance].slice(-8).reverse();
  const expiring = db.members
    .filter((m) => m.status === "pending" || m.status === "expired")
    .slice(0, 6);

  const metricCards = [
    {
      label: "Active Members",
      value: s.activeMembersCount,
      icon: "👥",
      accent: true,
      sub: `${db.members.length} total in system`,
    },
    {
      label: "Today's Check-ins",
      value: s.todayAttendance,
      icon: "✅",
      sub: "Real-time attendance",
    },
    {
      label: "Revenue this Month",
      value: formatPKR(s.revenueThisMonth),
      icon: "💰",
      sub: `${formatPKR(s.profitThisMonth)} net`,
      hideForUser: !can(currentUser, "finance.view"),
    },
    {
      label: "Low Stock Items",
      value: s.lowStockCount,
      icon: "📦",
      sub: "Threshold alerts",
      danger: s.lowStockCount > 0,
    },
    {
      label: "Pending Renewals",
      value: s.pendingRenewals,
      icon: "⏰",
      sub: `Within ${db.settings.subscriptionExpiryWarningDays} days`,
      warning: s.pendingRenewals > 0,
    },
  ].filter((c) => !c.hideForUser);

  const chartData = s.monthly.slice(-6).map((m) => ({
    label: m.label,
    Income: m.income,
    Expenses: m.expenses,
    Profit: m.profit,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Insights Center</h1>
          <p className="text-muted mt-1">Real-time operational snapshot of your gym.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/checkin" className="btn btn-primary">
            🎯 Quick Check-in
          </Link>
          <Link href="/dashboard/members" className="btn btn-secondary">
            ➕ New Member
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metricCards.map((m) => (
          <div key={m.label} className="metric-card">
            <div className="flex items-start justify-between">
              <div className="metric-icon">{m.icon}</div>
              {m.danger && <Badge variant="expired">Alert</Badge>}
              {m.warning && <Badge variant="pending">Watch</Badge>}
            </div>
            <div className="mt-4">
              <div className="text-xs text-muted uppercase tracking-wider font-semibold">
                {m.label}
              </div>
              <div className="text-3xl font-black tracking-tight mt-1">{m.value}</div>
              <div className="text-xs text-dim mt-1">{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {can(currentUser, "finance.view") && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">Revenue vs Expenses</h2>
                <p className="text-muted text-sm">Last 6 months, PKR</p>
              </div>
              <Badge variant="active">Net {formatPKR(s.netProfit)}</Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#a0a0a0" />
                  <YAxis stroke="#a0a0a0" />
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{
                      background: "#171717",
                      border: "1px solid #3a3a3a",
                      borderRadius: 8,
                    }}
                    formatter={(v) => formatPKR(Number(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey="Income"
                    stroke="#FF6B00"
                    fillOpacity={1}
                    fill="url(#inc)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Expenses"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#exp)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="font-bold text-lg mb-4">Monthly Profit</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#a0a0a0" />
                  <YAxis stroke="#a0a0a0" />
                  <Tooltip
                    contentStyle={{
                      background: "#171717",
                      border: "1px solid #3a3a3a",
                      borderRadius: 8,
                    }}
                    formatter={(v) => formatPKR(Number(v))}
                  />
                  <Bar dataKey="Profit" fill="#FF6B00" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Recent Check-ins</h2>
            <Link href="/dashboard/checkin" className="text-xs text-accent font-semibold">
              View all →
            </Link>
          </div>
          {recentAttendance.length === 0 ? (
            <div className="text-muted text-sm py-8 text-center">No check-ins yet today.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Time</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {recentAttendance.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.memberName}</td>
                    <td className="text-muted">
                      {new Date(r.checkedInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <Badge variant={r.method === "qr" ? "active" : "pending"}>{r.method}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Expiring / Expired Memberships</h2>
            <Link href="/dashboard/members" className="text-xs text-accent font-semibold">
              Manage →
            </Link>
          </div>
          {expiring.length === 0 ? (
            <div className="text-muted text-sm py-8 text-center">
              All memberships healthy. 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {expiring.map((m) => {
                const days = daysUntil(m.subscriptionEnd);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-app"
                  >
                    <div>
                      <div className="font-semibold text-sm">{m.fullName}</div>
                      <div className="text-xs text-muted">
                        Ends {formatDate(m.subscriptionEnd)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status === "expired" ? (
                        <Badge variant="expired">Expired</Badge>
                      ) : (
                        <Badge variant="pending">{days}d left</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Quick action shortcuts */}
      <Card>
        <h2 className="font-bold text-lg mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Check-in", href: "/dashboard/checkin", icon: "🎯" },
            { label: "Register Member", href: "/dashboard/members", icon: "➕" },
            { label: "Process Payment", href: "/dashboard/members", icon: "💳" },
            { label: "Add Inventory", href: "/dashboard/inventory", icon: "📦", adminOnly: true },
            { label: "New Plan", href: "/dashboard/subscriptions", icon: "⭐", adminOnly: true },
            { label: "Record Expense", href: "/dashboard/finances", icon: "🧾" },
            { label: "Export Reports", href: "/dashboard/finances", icon: "📊", adminOnly: true },
            { label: "Audit Logs", href: "/dashboard/logs", icon: "📜", adminOnly: true },
          ]
            .filter((a) => !a.adminOnly || can(currentUser, "finance.view"))
            .map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="p-4 rounded-xl border border-app bg-surface-2 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition text-center group"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition">{a.icon}</div>
                <div className="text-sm font-semibold">{a.label}</div>
              </Link>
            ))}
        </div>
      </Card>
    </div>
  );
}
