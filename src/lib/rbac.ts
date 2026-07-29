/**
 * Linux-style RBAC. Permissions are checked both at the UI layer (to hide/
 * disable controls) and at the service layer (to reject unauthorized
 * operations). Always re-check at the service layer before mutation.
 */
import type { User } from "./schema";

export type Permission =
  | "member.search"
  | "member.view"
  | "member.create"
  | "member.edit"
  | "member.delete"
  | "member.freeze"
  | "member.checkin"
  | "payment.process"
  | "inventory.view"
  | "inventory.create"
  | "inventory.edit"
  | "inventory.delete"
  | "plan.view"
  | "plan.create"
  | "plan.edit"
  | "plan.delete"
  | "finance.view"
  | "finance.edit"
  | "expense.create"
  | "logs.view"
  | "logs.clear"
  | "user.create"
  | "user.delete"
  | "settings.view"
  | "settings.edit";

const GRANTS: Record<"superuser" | "user", Permission[]> = {
  superuser: [
    "member.search",
    "member.view",
    "member.create",
    "member.edit",
    "member.delete",
    "member.freeze",
    "member.checkin",
    "payment.process",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "plan.view",
    "plan.create",
    "plan.edit",
    "plan.delete",
    "finance.view",
    "finance.edit",
    "expense.create",
    "logs.view",
    "logs.clear",
    "user.create",
    "user.delete",
    "settings.view",
    "settings.edit",
  ],
  user: [
    "member.search",
    "member.view",
    "member.create",
    "member.edit",
    "member.freeze",
    "member.checkin",
    "payment.process",
    "inventory.view",
    "plan.view",
    "expense.create",
    "settings.view",
  ],
};

export function can(user: User | null, perm: Permission): boolean {
  if (!user) return false;
  return GRANTS[user.role].includes(perm);
}

export function assertCan(user: User | null, perm: Permission): asserts user is User {
  if (!can(user, perm)) {
    throw new Error(`Permission denied: ${perm} requires a higher role.`);
  }
}
