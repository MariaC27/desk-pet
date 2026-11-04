// GitHub: OAuth Device Flow sign-in and the viewer's contribution calendar.
// Requests go through the Tauri HTTP plugin because GitHub's OAuth endpoints
// don't allow browser (CORS) requests.
import { fetch } from "@tauri-apps/plugin-http";
import { GITHUB_CLIENT_ID, GITHUB_SCOPE } from "./config";
import type { Account } from "./data";
import { toOffsetISO, type CalendarDay } from "./growth";

export type GitHubErrorKind = "auth" | "offline" | "rate_limited" | "denied" | "expired" | "unknown";

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    detail?: string,
  ) {
    super(detail ? `${kind}: ${detail}` : kind);
  }
}

const HEADERS = { Accept: "application/json", "User-Agent": "DeskPet" };

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers } });
  } catch (e) {
    throw new GitHubError("offline", String(e));
  }
}

const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields).toString(),
});

// ---- device flow -------------------------------------------------------------

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number; // epoch ms
  interval: number; // seconds between polls
}

export async function startDeviceFlow(): Promise<DeviceCode> {
  const res = await request(
    "https://github.com/login/device/code",
    form({ client_id: GITHUB_CLIENT_ID, scope: GITHUB_SCOPE }),
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new GitHubError("unknown", body.error ?? `HTTP ${res.status}`);
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    expiresAt: Date.now() + body.expires_in * 1000,
    interval: body.interval,
  };
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(signal.reason);
    });
  });
}

/** Polls until the user approves in the browser. Resolves with the access token. */
export async function waitForToken(code: DeviceCode, signal: AbortSignal): Promise<string> {
  let interval = code.interval;
  for (;;) {
    await sleep(interval * 1000, signal);
    if (Date.now() > code.expiresAt) throw new GitHubError("expired");

    let body;
    try {
      const res = await request(
        "https://github.com/login/oauth/access_token",
        form({
          client_id: GITHUB_CLIENT_ID,
          device_code: code.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      );
      body = await res.json();
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "offline") continue; // blip; keep waiting
      throw e;
    }

    if (body.access_token) return body.access_token;
    switch (body.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        interval = body.interval ?? interval + 5;
        continue;
      case "expired_token":
        throw new GitHubError("expired");
      case "access_denied":
        throw new GitHubError("denied");
      default:
        throw new GitHubError("unknown", body.error);
    }
  }
}

// ---- contributions -------------------------------------------------------------

const ACTIVITY_QUERY = `
query ($from: DateTime!, $to: DateTime!) {
  viewer {
    login
    name
    avatarUrl(size: 96)
    contributionsCollection(from: $from, to: $to) {
      restrictedContributionsCount
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

export interface Activity {
  account: Account;
  days: CalendarDay[];
  restrictedCount: number;
}

/**
 * Daily contribution counts between `from` and `to`. Times are sent with the
 * local UTC offset so GitHub buckets days in the user's timezone.
 */
export async function fetchActivity(token: string, from: Date, to: Date): Promise<Activity> {
  const res = await request("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: ACTIVITY_QUERY,
      variables: { from: toOffsetISO(from), to: toOffsetISO(to) },
    }),
  });

  if (res.status === 401) throw new GitHubError("auth");
  if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
    throw new GitHubError("rate_limited");
  }
  if (!res.ok) throw new GitHubError("unknown", `HTTP ${res.status}`);

  const body = await res.json();
  if (body.errors?.length) {
    const rateLimited = body.errors.some((e: { type?: string }) => e.type === "RATE_LIMITED");
    throw new GitHubError(rateLimited ? "rate_limited" : "unknown", body.errors[0]?.message);
  }

  const viewer = body.data.viewer;
  const collection = viewer.contributionsCollection;
  const days: CalendarDay[] = collection.contributionCalendar.weeks.flatMap(
    (w: { contributionDays: { date: string; contributionCount: number }[] }) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
  );
  return {
    account: { login: viewer.login, name: viewer.name, avatarUrl: viewer.avatarUrl },
    days,
    restrictedCount: collection.restrictedContributionsCount,
  };
}
