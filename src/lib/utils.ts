/** Misc helpers (formatters, validators, QR). */

export const PKRSymbol = "₨";

export function formatPKR(n: number): string {
  return `${PKRSymbol}${Math.round(n).toLocaleString("en-PK")}`;
}
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}
export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
export function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
export function daysUntil(iso?: string): number {
  if (!iso) return -1;
  return daysBetween(new Date().toISOString(), iso);
}
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

/** Six-digit numeric member ID printed on the member card. */
export function generateMemberUid(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Generate a QR code data URL via the `qrcode` library. */
export async function generateQrDataUrl(text: string): Promise<string> {
  // We dynamically import to keep SSR-safe and client-only.
  const QRCode = (await import("qrcode")).default;
  return await QRCode.toDataURL(text, {
    color: { dark: "#FF6B00", light: "#0D0D0D" },
    margin: 1,
    width: 256,
  });
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
