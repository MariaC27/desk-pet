// Messages from the sender page, via the `pair` / `messages` Edge Functions
// (supabase/functions). This Mac is identified by a device secret kept in the
// Keychain; the server only stores its hash.
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { fetch } from "@tauri-apps/plugin-http";
import { MESSAGES_EVERY_MS, SUPABASE_KEY, SUPABASE_URL } from "./config";
import {
  getMessages,
  getNotifyMessages,
  getPairing,
  getPendingReads,
  notifyDataChanged,
  onMessageCheckRequested,
  setMessages,
  setPairing,
  setPendingReads,
  type Message,
} from "./data";
import { emotionInfo } from "./emotions";
import { startPolling, type PollResult } from "./poller";
import { deleteSecret, getSecret, setSecret } from "./secrets";

export type MessagesErrorKind = "invalid_code" | "unpaired" | "offline" | "unknown";

export class MessagesError extends Error {
  constructor(public kind: MessagesErrorKind) {
    super(kind);
  }
}

async function call(
  fn: "pair" | "messages",
  init: { method: string; body?: unknown; secret?: string },
): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: init.method,
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        ...(init.secret ? { "x-device-secret": init.secret } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new MessagesError("offline");
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;
  if (body.error === "invalid_code" || body.error === "unpaired") throw new MessagesError(body.error);
  throw new MessagesError("unknown");
}

// ---- pairing ---------------------------------------------------------------------

/** Exchange a pairing code from the sender page for this Mac's device secret. */
export async function pair(code: string): Promise<string | null> {
  const { deviceSecret, recipientName } = await call("pair", { method: "POST", body: { code } });
  await setSecret("device_secret", deviceSecret);
  await setPairing({ recipientName, pairedAt: new Date().toISOString(), error: null });
  await setMessages([]);
  await setPendingReads([]);
  await notifyDataChanged();
  requestNotificationPermission();
  return recipientName;
}

/** Forget the pairing here, and tell the server (best effort) so the sender sees it's gone. */
export async function unpair() {
  const secret = await getSecret("device_secret").catch(() => null);
  if (secret) await call("messages", { method: "DELETE", secret }).catch(() => {});
  await deleteSecret("device_secret");
  await setPairing(null);
  await setMessages([]);
  await setPendingReads([]);
  await notifyDataChanged();
}

// ---- checking for messages ---------------------------------------------------------

async function requestNotificationPermission() {
  if (!(await isPermissionGranted())) await requestPermission();
}

async function notifyNew(fresh: Message[]) {
  if (!(await getNotifyMessages())) return;
  if (!(await isPermissionGranted())) return;
  const [only] = fresh;
  const feeling = fresh.length === 1 && !only.body.trim() ? emotionInfo(only.mood) : null;
  sendNotification(
    feeling
      ? { title: feeling.notify, body: "Click your plant to see." }
      : {
          title: fresh.length === 1 ? "A little note arrived 💌" : `${fresh.length} little notes arrived 💌`,
          body: "Click your plant to read it.",
        },
  );
}

async function flushPendingReads(secret: string) {
  const pending = await getPendingReads();
  if (!pending.length) return;
  await call("messages", { method: "POST", body: { read: pending }, secret });
  await setPendingReads([]);
}

export async function checkMessagesOnce(): Promise<PollResult> {
  let secret: string | null;
  try {
    secret = await getSecret("device_secret");
  } catch {
    return "retry"; // Keychain unavailable for now; still paired
  }
  if (!secret) return "idle";

  try {
    await flushPendingReads(secret);
    const { messages: fetched } = (await call("messages", { method: "GET", secret })) as { messages: Message[] };

    const local = await getMessages();
    const known = new Set(local.map((m) => m.id));
    const readHere = new Map(local.filter((m) => m.readAt).map((m) => [m.id, m.readAt]));
    // The server is the source of truth (deleted messages disappear), but keep
    // reads made here that it hasn't heard about yet.
    const merged = fetched.map((m) => ({ ...m, readAt: m.readAt ?? readHere.get(m.id) ?? null }));
    const fresh = merged.filter((m) => !known.has(m.id) && !m.readAt);

    await setMessages(merged);
    const pairing = await getPairing();
    if (pairing?.error) await setPairing({ ...pairing, error: null });
    await notifyDataChanged();
    if (fresh.length) notifyNew(fresh);
    return "ok";
  } catch (e) {
    if (e instanceof MessagesError && e.kind === "unpaired") {
      // The sender removed this Mac (or the recipient). Keep the history, drop the secret.
      await deleteSecret("device_secret");
      const pairing = await getPairing();
      await setPairing({ recipientName: pairing?.recipientName ?? null, pairedAt: pairing?.pairedAt ?? "", error: "unpaired" });
      await notifyDataChanged();
      return "idle";
    }
    return "retry";
  }
}

/** Marks messages read locally right away, then tells the server (retried if offline). */
export async function markRead(ids: string[]) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  const local = await getMessages();
  await setMessages(local.map((m) => (ids.includes(m.id) && !m.readAt ? { ...m, readAt: now } : m)));
  await setPendingReads([...new Set([...(await getPendingReads()), ...ids])]);
  await notifyDataChanged();

  const secret = await getSecret("device_secret").catch(() => null);
  if (secret) await flushPendingReads(secret).catch(() => {});
}

export function startMessageLoop(): () => void {
  return startPolling({
    everyMs: MESSAGES_EVERY_MS,
    onRequest: onMessageCheckRequested,
    run: checkMessagesOnce,
  });
}
