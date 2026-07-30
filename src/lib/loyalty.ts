/**
 * Loyalty token engine and member motivation achievements.
 */
import type { InventoryItem, Member, SubscriptionPlan, Transaction } from "./schema";

export interface TokenGrant {
  earn: number;
  redeem: number;
}

export function computeTokensForPlan(plan: SubscriptionPlan, paidWithTokens: boolean): TokenGrant {
  return { earn: paidWithTokens ? 0 : plan.tokenGrant, redeem: paidWithTokens ? plan.price : 0 };
}

export function computeTokensForItem(item: InventoryItem, quantity: number, paidWithTokens: boolean): TokenGrant {
  return {
    earn: paidWithTokens ? 0 : item.tokenValue * quantity,
    redeem: paidWithTokens ? (item.redemptionCost ?? 0) * quantity : 0,
  };
}

export function totalTokensEarned(memberId: string, txs: Transaction[]): number {
  return txs.filter((t) => t.memberId === memberId).reduce((sum, t) => sum + Math.max(0, t.tokensDelta), 0);
}

export function totalTokensSpent(memberId: string, txs: Transaction[]): number {
  return txs.filter((t) => t.memberId === memberId).reduce((sum, t) => sum + Math.abs(Math.min(0, t.tokensDelta)), 0);
}

type AchievementMetric = "spent" | "earned" | "redeemed" | "attendance" | "transactions" | "memberships" | "items" | "cashPurchases";

export interface AchievementDefinition {
  title: string;
  description: string;
  icon: string;
  metric: AchievementMetric;
  threshold: number;
}

const milestone = (
  metric: AchievementMetric,
  thresholds: number[],
  names: string[],
  descriptions: string[],
  icons: string[]
): AchievementDefinition[] =>
  thresholds.map((threshold, index) => ({
    metric,
    threshold,
    title: names[index],
    description: descriptions[index],
    icon: icons[index],
  }));

/** Fifty unlockable trophies shown in every member's trophy cabinet. */
export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  ...milestone("spent", [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000],
    ["First 1K Spent", "Quarter Club", "Five K Strong", "Big Spender", "Elite Investor", "Platinum Member", "Diamond Member", "Obsidian Patron"],
    ["Spent over PKR 1,000 lifetime", "Spent over PKR 2,500 lifetime", "Spent over PKR 5,000 lifetime", "Spent over PKR 10,000 lifetime", "Spent over PKR 25,000 lifetime", "Spent over PKR 50,000 lifetime", "Spent over PKR 100,000 lifetime", "Spent over PKR 250,000 lifetime"],
    ["💪", "🥉", "🥈", "🏆", "💎", "👑", "🌟", "🖤"]),
  ...milestone("earned", [10, 25, 50, 100, 250, 500, 1000],
    ["Token Starter", "Token Builder", "Token Hunter", "Loyalty Legend", "Token Champion", "Token Master", "Token Titan"],
    ["Earned 10 loyalty tokens", "Earned 25 loyalty tokens", "Earned 50 loyalty tokens", "Earned 100 loyalty tokens", "Earned 250 loyalty tokens", "Earned 500 loyalty tokens", "Earned 1,000 loyalty tokens"],
    ["🪙", "🔋", "⚡", "🔥", "🎯", "🚀", "🌌"]),
  ...milestone("redeemed", [10, 25, 50, 100, 250, 500],
    ["First Redemption", "Reward Seeker", "Token Redeemer", "Reward Regular", "Reward Expert", "Reward Legend"],
    ["Redeemed 10 loyalty tokens", "Redeemed 25 loyalty tokens", "Redeemed 50 loyalty tokens", "Redeemed 100 loyalty tokens", "Redeemed 250 loyalty tokens", "Redeemed 500 loyalty tokens"],
    ["🎁", "🎟️", "🎉", "🏅", "🎊", "🏆"]),
  ...milestone("attendance", [1, 3, 7, 14, 30, 50, 100, 250, 365],
    ["First Visit", "Three Visits", "Week Warrior", "Fortnight Force", "Monthly Mover", "Fifty Club", "Century Club", "Quarter Year", "Year-Round Athlete"],
    ["Completed your first check-in", "Completed 3 check-ins", "Completed 7 check-ins", "Completed 14 check-ins", "Completed 30 check-ins", "Completed 50 check-ins", "Completed 100 check-ins", "Completed 250 check-ins", "Completed 365 check-ins"],
    ["👋", "🥉", "🔥", "💪", "🏋️", "🥇", "💯", "🏆", "👑"]),
  ...milestone("transactions", [1, 3, 5, 10, 25, 50, 100],
    ["First Purchase", "Getting Started", "Regular Customer", "Committed Member", "Dedicated Member", "Super Regular", "Legacy Member"],
    ["Completed 1 purchase", "Completed 3 purchases", "Completed 5 purchases", "Completed 10 purchases", "Completed 25 purchases", "Completed 50 purchases", "Completed 100 purchases"],
    ["🛒", "📦", "⭐", "✅", "💼", "🌟", "🏛️"]),
  ...milestone("memberships", [1, 2, 3, 5, 10],
    ["Joined the Pack", "Second Wind", "Triple Commitment", "Five-Star Member", "Membership Master"],
    ["Purchased your first membership", "Purchased 2 memberships", "Purchased 3 memberships", "Purchased 5 memberships", "Purchased 10 memberships"],
    ["🎫", "🔁", "🎯", "⭐", "👑"]),
  ...milestone("items", [1, 5, 10, 25, 50],
    ["First Gear", "Gear Collector", "Well Equipped", "Kit Specialist", "Gear Legend"],
    ["Purchased your first item", "Purchased 5 items", "Purchased 10 items", "Purchased 25 items", "Purchased 50 items"],
    ["🎒", "🧰", "🏃", "🥋", "🏆"]),
  ...milestone("cashPurchases", [1, 5, 15],
    ["First Cash Session", "Cash Champion", "Investment Athlete"],
    ["Completed your first cash purchase", "Completed 5 cash purchases", "Completed 15 cash purchases"],
    ["💵", "💳", "📈"]),
];

function metricValue(definition: AchievementDefinition, member: Member, txs: Transaction[], attendanceCount: number): number {
  const memberTxs = txs.filter((t) => t.memberId === member.id);
  switch (definition.metric) {
    case "spent": return member.totalSpent;
    case "earned": return totalTokensEarned(member.id, txs);
    case "redeemed": return totalTokensSpent(member.id, txs);
    case "attendance": return attendanceCount;
    case "transactions": return memberTxs.filter((t) => t.type !== "expense").length;
    case "memberships": return memberTxs.filter((t) => t.type.startsWith("membership")).length;
    case "items": return memberTxs.filter((t) => t.type === "item_purchase").length;
    case "cashPurchases": return memberTxs.filter((t) => t.type !== "expense" && !t.paidWithTokens).length;
  }
}

export function getMemberAchievementStatuses(member: Member, txs: Transaction[], attendanceCount: number) {
  return ACHIEVEMENT_CATALOG.map((definition) => ({
    ...definition,
    earned: (member.achievements ?? []).some((a) => a.title === definition.title) ||
      metricValue(definition, member, txs, attendanceCount) >= definition.threshold,
  }));
}

/** Backwards-compatible helper for callers that need only earned achievements. */
export function computeMemberAchievements(member: Member, txs: Transaction[]) {
  return (getMemberAchievementStatuses(member, txs, 0).filter((a) => a.earned)).map(({ earned: _earned, ...achievement }) => ({
    id: Math.random().toString(36).slice(2),
    type: "milestone" as const,
    ...achievement,
    awardedAt: new Date().toISOString(),
  }));
}
