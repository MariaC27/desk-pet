// Public identifiers (safe to ship in the app; no secrets here).

/** GitHub OAuth App with Device Flow enabled. */
export const GITHUB_CLIENT_ID = "Ov23lipt3hS0A607tAx8";

/** Read-only profile access; enough for the viewer's contribution calendar. */
export const GITHUB_SCOPE = "read:user";

/** How many weeks of history we fetch: shown in the tracker's graph and used to scale growth. */
export const HISTORY_WEEKS = 24;

export const SYNC_EVERY_MS = 5 * 60_000;

/** Supabase project for messages (the publishable key is meant to be public). */
export const SUPABASE_URL = "https://tuvacbefvbhvnuyeoogu.supabase.co";
export const SUPABASE_KEY = "sb_publishable_fxKVI6nIUKcUfPOtUeQaYw_gTrLXaV_";

export const MESSAGES_EVERY_MS = 2 * 60_000;
