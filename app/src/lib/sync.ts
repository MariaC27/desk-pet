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
import { startPolling } from "./poller";
import { getSecret } from "./secrets";

export async function syncOnce(): Promise<SyncStatus> {
  const now = new Date();
  const prev = await getSyncStatus();
  let status: SyncStatus;

  // A Keychain failure isn't a logout: keep the account and data, and retry.
  const token = await getSecret("github_token").catch(() => undefined);
  if (token === undefined) {
    status = { ...prev, lastAttemptAt: now.toISOString(), error: "keychain" };
  } else if (!token) {
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

const updateTray = async () => {
  const text = syncStatusText(await getSyncStatus());
  invoke("set_tray_status", { text }).catch(() => {});
};

/** GitHub sync on launch, every SYNC_EVERY_MS, on wake, and on "Sync now". */
export function startSyncLoop(): () => void {
  return startPolling({
    everyMs: SYNC_EVERY_MS,
    onRequest: onSyncRequested,
    onTick: updateTray,
    run: async () => {
      const { error } = await syncOnce();
      updateTray();
      if (error === "offline" || error === "rate_limited" || error === "unknown" || error === "keychain") return "retry";
      return error ? "idle" : "ok";
    },
  });
}
