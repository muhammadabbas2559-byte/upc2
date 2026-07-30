/**
 * Core data schema for the Offline Gym Management System.
 * All records carry stable string IDs and ISO-8601 timestamps.
 */

export type Role = "superuser" | "user";

export interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  /** Only present for superuser: used to unlock DB for all users in future. */
  isSuperuser?: boolean;
}

export type MemberStatus = "active" | "frozen" | "expired" | "pending";

export interface Member {
  id: string;
  uid: string; // Short gym-assigned UID (printed on ID card)
  fullName: string;
  cnic?: string;
  phone: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  gender?: "male" | "female" | "other";
  dob?: string;
  joinDate: string;
  photo?: string; // data URL (optional, 100% offline)
  status: MemberStatus;
  subscriptionId?: string; // active plan id
  subscriptionStart?: string;
  subscriptionEnd?: string;
  frozenSince?: string;
  loyaltyTokens: number;
  totalSpent: number; // PKR lifetime
  notes?: string;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  type: "milestone" | "purchase" | "membership" | "custom";
  title: string;
  description?: string;
  icon: string; // emoji for trophy cabinet
  awardedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  category?: string;
  stockQty: number;
  lowStockThreshold: number;
  price: number; // PKR
  tokenValue: number; // tokens earned on purchase (0 if redemption item)
  isRedeemable: boolean; // can be bought with tokens?
  redemptionCost?: number; // tokens needed (if redeemable)
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  durationDays: number;
  price: number; // PKR
  tokenGrant: number; // tokens granted upon buying
  tier: "basic" | "premium" | "vip" | "custom";
  active: boolean;
  createdAt: string;
}

export type TxType =
  | "membership_purchase"
  | "membership_renewal"
  | "membership_upgrade"
  | "item_purchase"
  | "item_redemption"
  | "token_grant"
  | "expense";

export interface Transaction {
  id: string;
  type: TxType;
  memberId?: string;
  userId?: string; // operator who processed
  amount: number; // PKR (negative = expense)
  tokensDelta: number; // negative if redeemed
  itemId?: string;
  planId?: string;
  note?: string;
  expenseCategory?: string;
  paidWithTokens: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  checkedInAt: string;
  checkedOutAt?: string;
  checkedOutBy?: string;
  checkedInBy: string; // user id
  method: "manual" | "qr";
}

export interface Expense {
  id: string;
  name: string;
  description?: string;
  amount: number; // PKR
  category: string;
  date: string;
  createdBy: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "danger" | "success";
  read: boolean;
  createdAt: string;
}

export interface SystemSettings {
  gymName: string;
  currency: string;
  qrAttendanceEnabled: boolean;
  turnstileEnabled: boolean;
  theme: "dark" | "light";
  lowStockThresholdGlobal: number;
  subscriptionExpiryWarningDays: number;
  quickActions: string[];
  tokenPerPkr?: number; // future: bonus tokens per PKR spent
}

export interface LogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  detail?: string;
  timestamp: string;
  ip?: string; // local stub
}

/** Full database shape — stored encrypted in localStorage. */
export interface Database {
  version: number;
  users: User[];
  members: Member[];
  inventory: InventoryItem[];
  plans: SubscriptionPlan[];
  transactions: Transaction[];
  attendance: AttendanceRecord[];
  expenses: Expense[];
  notifications: Notification[];
  settings: SystemSettings;
  /** Session logs are stored separately per-user, but a global audit index may live here. */
}

export const DB_VERSION = 1;

export function defaultSettings(): SystemSettings {
  return {
    gymName: "Obsidian Gym Manager",
    currency: "PKR",
    qrAttendanceEnabled: false,
    turnstileEnabled: false,
    theme: "dark",
    lowStockThresholdGlobal: 5,
    subscriptionExpiryWarningDays: 7,
    quickActions: ["checkin", "new-member", "new-payment", "inventory"],
  };
}

export function emptyDatabase(): Database {
  return {
    version: DB_VERSION,
    users: [],
    members: [],
    inventory: [],
    plans: [],
    transactions: [],
    attendance: [],
    expenses: [],
    notifications: [],
    settings: defaultSettings(),
  };
}
