// POST { code: "PLANT-7Q4K-M2XD" } -> { deviceSecret, recipientName }
// Claims a single-use pairing code and registers a new device for its recipient.
import { admin, json, randomSecret, sha256Hex } from "../_shared/util.ts";

/** "plant-7q4k m2xd" -> "7Q4KM2XD" (the part the database hashed). */
function normalize(code: string): string | null {
  let raw = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length === 13 && raw.startsWith("PLANT")) raw = raw.slice(5);
  return raw.length === 8 ? raw : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { code } = await req.json().catch(() => ({}));
  const raw = typeof code === "string" ? normalize(code) : null;
  if (!raw) return json({ error: "invalid_code" }, 400);

  const now = new Date().toISOString();
  // Claim atomically: only one caller can flip used_at on a live code.
  const { data: claimed, error } = await admin
    .from("pairing_codes")
    .update({ used_at: now })
    .eq("code_hash", await sha256Hex(raw))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("recipient_id")
    .maybeSingle();
  if (error) {
    console.error("claim failed", error);
    return json({ error: "server_error" }, 500);
  }
  if (!claimed) return json({ error: "invalid_code" }, 404);

  const deviceSecret = randomSecret();
  const { error: insertError } = await admin
    .from("devices")
    .insert({ recipient_id: claimed.recipient_id, secret_hash: await sha256Hex(deviceSecret) });
  if (insertError) {
    console.error("device insert failed", insertError);
    return json({ error: "server_error" }, 500);
  }

  const { data: recipient } = await admin
    .from("recipients")
    .select("display_name")
    .eq("id", claimed.recipient_id)
    .single();

  return json({ deviceSecret, recipientName: recipient?.display_name ?? null });
});
