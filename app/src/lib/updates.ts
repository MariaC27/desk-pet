// New versions from the repo's GitHub Releases (see src-tauri/src/updates.rs).
// The app only checks and lets the person know; it installs when they click
// "Install & Restart" in Settings.
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, sendNotification } from "@tauri-apps/plugin-notification";
import { UPDATE_CHECK_EVERY_MS } from "./config";
import { getUpdateNotified, notifyDataChanged, setUpdate, setUpdateNotified, type UpdateInfo } from "./data";
import { startPolling, type PollResult } from "./poller";

async function announce(info: UpdateInfo) {
  if ((await getUpdateNotified()) === info.version) return;
  await setUpdateNotified(info.version);
  if (!(await isPermissionGranted())) return;
  sendNotification({
    title: `Desk Pet ${info.version} is available`,
    body: "Install it from Settings whenever you like.",
  });
}

/** Asks GitHub for a newer release. Returns it, or null when up to date. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const info = await invoke<UpdateInfo | null>("check_update");
  await setUpdate(info);
  await notifyDataChanged();
  if (info) announce(info);
  return info;
}

/** The update to offer, if it's newer than what's running (the stored one can be stale right after updating). */
export async function availableUpdate(stored: UpdateInfo | null): Promise<UpdateInfo | null> {
  return stored && stored.version !== (await getVersion()) ? stored : null;
}

/** Downloads and installs, then the app restarts itself. `onProgress` gets 0..1 (or null if the size is unknown). */
export async function installUpdate(onProgress: (fraction: number | null) => void) {
  const unlisten = await listen<[number, number | null]>("update-progress", ({ payload: [done, total] }) =>
    onProgress(total ? done / total : null),
  );
  try {
    await invoke("install_update");
  } finally {
    unlisten();
  }
}

export function startUpdateLoop(): () => void {
  return startPolling({
    everyMs: UPDATE_CHECK_EVERY_MS,
    run: async (): Promise<PollResult> => {
      await checkForUpdate();
      return "ok";
    },
  });
}
