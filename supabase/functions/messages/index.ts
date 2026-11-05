// For a paired device (header `x-device-secret`):
//   GET                      -> { messages: [{ id, body, createdAt, readAt }] }  (marks them delivered)
//   POST { read: [ids...] }  -> { ok: true }                                     (marks them read)
// 401 { error: "unpaired" } if the device secret is unknown (e.g. the sender removed it).
import { admin, deviceFor, json } from "../_shared/util.ts";

const MAX_MESSAGES = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  let device;
  try {
    device = await deviceFor(req);
  } catch (e) {
    console.error("device lookup failed", e);
    return json({ error: "server_error" }, 500);
  }
  if (!device) return json({ error: "unpaired" }, 401);
  const now = new Date().toISOString();

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("messages")
      .select("id, body, created_at, delivered_at, read_at")
      .eq("recipient_id", device.recipient_id)
      .order("created_at", { ascending: true })
      .limit(MAX_MESSAGES);
    if (error) {
      console.error("fetch failed", error);
      return json({ error: "server_error" }, 500);
    }

    // Only mark what we're actually returning, so nothing is "delivered" unseen.
    const undelivered = data.filter((m) => !m.delivered_at).map((m) => m.id);
    if (undelivered.length) {
      await admin.from("messages").update({ delivered_at: now }).in("id", undelivered);
    }
    await admin.from("devices").update({ last_seen_at: now }).eq("id", device.id);

    return json({
      messages: data.map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, readAt: m.read_at })),
    });
  }

  if (req.method === "POST") {
    const { read } = await req.json().catch(() => ({}));
    const ids = Array.isArray(read) ? read.filter((id) => typeof id === "string" && UUID.test(id)) : [];
    if (ids.length) {
      const { error } = await admin
        .from("messages")
        .update({ read_at: now })
        .eq("recipient_id", device.recipient_id)
        .in("id", ids)
        .is("read_at", null);
      if (error) {
        console.error("mark read failed", error);
        return json({ error: "server_error" }, 500);
      }
    }
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
});
