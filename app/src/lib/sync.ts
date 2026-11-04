// Background GitHub sync. Runs in the pet window, which exists for the app's
// whole lifetime (even while hidden).
import { invoke } from "@tauri-apps/api/core";
import { HISTORY_WEEKS, SYNC_EVERY_MS } from "./config";
import {
  getSyncStatus,
  notifyDataChanged,
  onSyncRequested,
  setAccount,
  setCalendar,
  setSyncStatus,
  type SyncError,
  type SyncStatus,
} from "./data";
import { syncStatusText } from "./format";
import { GitHubError, fetchActivity } from "./github";
import { startOfWeek } from "./growth";
import { getSecret } from "./secrets";

const TICK_MS = 60_000;
const RETRY_BASE_MS = 60_000;

export async function syncOnce(): Promise<SyncStatus> {
  const now = new Date();
  const prev = await getSyncStatus();
  let status: SyncStatus;

  const token = await getSecret("github_token").catch(() => null);
  if (!token) {
    status = { ...prev, lastAttemptAt: now.toISOString(), error: "not_connected" };
  } else {
    try {
      const from = startOfWeek(now);
      from.setDate(from.getDate() - 7 * (HISTORY_WEEKS - 1));
      const activity = await fetchActivity(token, from, now);
      await setAccount(activity.account);
      await setCalendar({
        days: activity.days,
        fetchedAt: now.toISOString(),
        restrictedCount: activity.restrictedCount,
      });
      status = { lastSuccessAt: now.toISOString(), lastAttemptAt: now.toISOString(), error: null };
    } catch (e) {
      console.error("sync failed", e);
      const kind = e instanceof GitHubError ? e.kind : "unknown";
      const error: SyncError = kind === "auth" || kind === "offline" || kind === "rate_limited" ? kind : "unknown";
      status = { ...prev, lastAttemptAt: now.toISOString(), error };
    }
  }

  await setSyncStatus(status);
  await notifyDataChanged();
  return status;
}

/**
 * Sync now, then every SYNC_EVERY_MS. Network failures retry sooner with
 * backoff; waking from sleep (a long gap between ticks) syncs immediately.
 * Returns a stop function.
 */
export function startSyncLoop(): () => void {
  let nextAt = 0;
  let failures = 0;
  let lastTick = Date.now();
  let running = false;

  const updateTray = async () => {
    const text = syncStatusText(await getSyncStatus());
    invoke("set_tray_status", { text }).catch(() => {});
  };

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { error } = await syncOnce();
      const retryable = error === "offline" || error === "rate_limited" || error === "unknown";
      failures = retryable ? failures + 1 : 0;
      nextAt = Date.now() + (retryable ? Math.min(SYNC_EVERY_MS, RETRY_BASE_MS * 2 ** (failures - 1)) : SYNC_EVERY_MS);
    } finally {
      running = false;
      updateTray();
    }
  };

  const tick = () => {
    const now = Date.now();
    const woke = now - lastTick > 3 * TICK_MS;
    lastTick = now;
    if (woke || now >= nextAt) run();
    else updateTray();
  };

  run();
  const id = setInterval(tick, TICK_MS);
  const unlisten = onSyncRequested(() => run());
  return () => {
    clearInterval(id);
    unlisten.then((f) => f());
  };
}
