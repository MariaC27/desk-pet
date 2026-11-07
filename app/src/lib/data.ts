// Non-secret app data in the shared settings store, plus a "data-changed"
// event so every window can refresh when something updates.
import { emit, listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";
import type { Emotion } from "./emotions";
import type { CalendarDay } from "./growth";
import type { PlantStyle } from "../pet/sprite";

export interface Account {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface CalendarCache {
  days: CalendarDay[];
  fetchedAt: string; // ISO
  /** Private contributions GitHub reports but doesn't break down by day. */
  restrictedCount: number;
}

export type SyncError = "not_connected" | "keychain" | "auth" | "offline" | "rate_limited" | "unknown";

export interface SyncStatus {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  error: SyncError | null;
}

export const EMPTY_STATUS: SyncStatus = { lastSuccessAt: null, lastAttemptAt: null, error: null };

let storePromise: ReturnType<typeof load> | null = null;
const store = () => (storePromise ??= load("settings.json", { autoSave: 200 }));

async function get<T>(key: string): Promise<T | null> {
  return (await (await store()).get<T>(key)) ?? null;
}

async function set(key: string, value: unknown) {
  const s = await store();
  if (value === null) await s.delete(key);
  else await s.set(key, value);
}

export const getAccount = () => get<Account>("account");
export const setAccount = (a: Account | null) => set("account", a);

export const getCalendar = () => get<CalendarCache>("calendar");
export const setCalendar = (c: CalendarCache | null) => set("calendar", c);

export const getSyncStatus = async () => (await get<SyncStatus>("syncStatus")) ?? EMPTY_STATUS;
export const setSyncStatus = (s: SyncStatus) => set("syncStatus", s);

export const notifyDataChanged = () => emit("data-changed");
export const onDataChanged = (cb: () => void) => listen("data-changed", cb);

export const requestSync = () => emit("sync-now");
export const onSyncRequested = (cb: () => void) => listen("sync-now", cb);

/** Dev panel override of the pet's state; null = use real data. */
export const getDevOverride = <T>() => get<T>("devOverride");
export const setDevOverride = (v: unknown) => set("devOverride", v);

// ---- messages ------------------------------------------------------------------

export interface Pairing {
  recipientName: string | null;
  pairedAt: string; // ISO
  /** Set when the server no longer recognises this Mac (the sender removed it). */
  error: "unpaired" | null;
}

export interface Message {
  id: string;
  body: string; // may be empty when the message is just an emotion
  mood: Emotion | null;
  createdAt: string;
  readAt: string | null;
}

export const getPairing = () => get<Pairing>("pairing");
export const setPairing = (p: Pairing | null) => set("pairing", p);

/** Server's message list as of the last check (newest last). */
export const getMessages = async () => (await get<Message[]>("messages")) ?? [];
export const setMessages = (m: Message[]) => set("messages", m);

/** Messages read locally whose "read" hasn't reached the server yet. */
export const getPendingReads = async () => (await get<string[]>("pendingReads")) ?? [];
export const setPendingReads = (ids: string[]) => set("pendingReads", ids);

export const getNotifyMessages = async () => (await get<boolean>("notifyMessages")) ?? true;
export const setNotifyMessages = (on: boolean) => set("notifyMessages", on);

export const getPlantStyle = async () => (await get<PlantStyle>("plantStyle")) ?? "blossom";
export const setPlantStyle = (p: PlantStyle) => set("plantStyle", p);

export const requestMessageCheck = () => emit("check-messages");
export const onMessageCheckRequested = (cb: () => void) => listen("check-messages", cb);
