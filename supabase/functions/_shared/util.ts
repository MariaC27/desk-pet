import { createClient } from "jsr:@supabase/supabase-js@2";

/** Service-role client: bypasses RLS, so every query must scope by recipient. */
export const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** Hex SHA-256; must match public.sha256_hex() in the database. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSecret(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * The paired device making this request, from its `x-device-secret` header.
 * null = unknown secret; throws on database errors so they aren't mistaken
 * for "unpaired" (which would make the app drop its pairing).
 */
export async function deviceFor(req: Request): Promise<{ id: string; recipient_id: string } | null> {
  const secret = req.headers.get("x-device-secret");
  if (!secret) return null;
  const { data, error } = await admin
    .from("devices")
    .select("id, recipient_id")
    .eq("secret_hash", await sha256Hex(secret))
    .maybeSingle();
  if (error) throw error;
  return data;
}
