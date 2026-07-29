/**
 * Loyalty token engine.
 * Rules:
 *  - Tokens are earned when a member purchases/upgrades a membership plan OR
 *    buys an inventory item with CASH (or card, etc.).
 *  - Items/memberships paid for (entirely or partially) with loyalty tokens
 *    DO NOT grant new loyalty tokens.
 *  - Each item has a `tokenValue` and optional `redemptionCost`.
 */
import type { InventoryItem, Member, SubscriptionPlan, Transaction } from "./schema";

export interface TokenGrant {
  earn: number;
  redeem: number;
}

/**
 * Compute tokens for a purchase.
 * If paidWithTokens = true => earn 0. If false => earn plan's tokenGrant (or item's tokenValue).
 */
export function computeTokensForPlan(
  plan: SubscriptionPlan,
  paidWithTokens: boolean
): TokenGrant {
  return { earn: paidWithTokens ? 0 : plan.tokenGrant, redeem: paidWithTokens ? plan.price : 0 };
}

export function computeTokensForItem(
  item: InventoryItem,
  quantity: number,
  paidWithTokens: boolean
): TokenGrant {
  return {
    earn: paidWithTokens ? 0 : item.tokenValue * quantity,
    redeem: paidWithTokens ? (item.redemptionCost ?? 0) * quantity : 0,
  };
}

/** Sum total tokens earned by a member (for stats). */
export function totalTokensEarned(memberId: string, txs: Transaction[]): number {
  return txs
    .filter((t) => t.memberId === memberId)
    .reduce((sum, t) => sum + Math.max(0, t.tokensDelta), 0);
}

export function totalTokensSpent(memberId: string, txs: Transaction[]): number {
  return txs
    .filter((t) => t.memberId === memberId)
    .reduce((sum, t) => sum + Math.abs(Math.min(0, t.tokensDelta)), 0);
}

/** Auto-achievements (trophies) for the member profile. */
export function computeMemberAchievements(
  member: Member,
  txs: Transaction[]
) {
  const earned = totalTokensEarned(member.id, txs);
  const spent = totalTokensSpent(member.id, txs);
  const now = new Date().toISOString();
  const achievements = [...(member.achievements ?? [])];

  const has = (title: string) => achievements.some((a) => a.title === title);

  if (member.totalSpent >= 1000 && !has("First 1K Spent")) {
    achievements.push({
      id: Math.random().toString(36).slice(2),
      type: "milestone",
      title: "First 1K Spent",
      description: "Spent over ₨1,000 lifetime",
      icon: "💪",
      awardedAt: now,
    });
  }
  if (member.totalSpent >= 10000 && !has("Big Spender")) {
    achievements.push({
      id: Math.random().toString(36).slice(2),
      type: "milestone",
      title: "Big Spender",
      description: "Lifetime spending over ₨10,000",
      icon: "🏆",
      awardedAt: now,
    });
  }
  if (earned >= 100 && !has("Loyalty Legend")) {
    achievements.push({
      id: Math.random().toString(36).slice(2),
      type: "milestone",
      title: "Loyalty Legend",
      description: "Earned over 100 loyalty tokens",
      icon: "🔥",
      awardedAt: now,
    });
  }
  if (spent >= 50 && !has("Token Redeemer")) {
    achievements.push({
      id: Math.random().toString(36).slice(2),
      type: "milestone",
      title: "Token Redeemer",
      description: "Redeemed over 50 loyalty tokens",
      icon: "🎁",
      awardedAt: now,
    });
  }
  return achievements;
}
