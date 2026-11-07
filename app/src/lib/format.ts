import type { SyncStatus } from "./data";

export function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** One-line sync summary for the tray menu and tracker footer. */
export function syncStatusText(s: SyncStatus, now = new Date()): string {
  if (s.error === "not_connected") return "GitHub not connected";
  if (s.error === "auth") return "GitHub needs reconnecting";
  if (s.error === "keychain") return "Waiting for Keychain access";
  if (!s.lastSuccessAt) return s.error ? "Can't reach GitHub yet" : "Not synced yet";
  const ago = timeAgo(s.lastSuccessAt, now);
  if (s.error === "offline") return `Offline · synced ${ago}`;
  if (s.error) return `Sync paused · synced ${ago}`;
  return `Synced ${ago}`;
}
