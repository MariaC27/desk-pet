// Public identifiers (safe to ship in the app; no secrets here).

/** GitHub OAuth App with Device Flow enabled. */
export const GITHUB_CLIENT_ID = "Ov23lipt3hS0A607tAx8";

/** Read-only profile access; enough for the viewer's contribution calendar. */
export const GITHUB_SCOPE = "read:user";

/** How many weeks of history the tracker shows (and we fetch). */
export const HISTORY_WEEKS = 24;

export const SYNC_EVERY_MS = 10 * 60_000;
