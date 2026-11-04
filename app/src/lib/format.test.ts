import { describe, expect, it } from "vitest";
import { EMPTY_STATUS } from "./data";
import { syncStatusText, timeAgo } from "./format";
import { toOffsetISO } from "./growth";
import { derivePetState } from "./petState";

const now = new Date(2026, 10, 5, 12, 0); // Thu Nov 5 2026, noon local

describe("timeAgo / syncStatusText", () => {
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

  it("formats durations", () => {
    expect([0, 5, 90, 60 * 30, 60 * 24 * 3].map((m) => timeAgo(ago(m), now))).toEqual([
      "just now",
      "5 min ago",
      "1 h ago",
      "yesterday",
      "3 days ago",
    ]);
  });

  it("describes each sync state", () => {
    const ok = { lastSuccessAt: ago(3), lastAttemptAt: ago(3), error: null };
    expect(syncStatusText(ok, now)).toBe("Synced 3 min ago");
    expect(syncStatusText({ ...ok, error: "offline" }, now)).toBe("Offline · synced 3 min ago");
    expect(syncStatusText({ ...ok, error: "auth" }, now)).toBe("GitHub needs reconnecting");
    expect(syncStatusText(EMPTY_STATUS, now)).toBe("Not synced yet");
  });
});

describe("toOffsetISO", () => {
  it("keeps local wall time with the local offset (America/New_York in tests)", () => {
    expect(toOffsetISO(new Date(2026, 10, 2, 0, 0, 0))).toBe("2026-11-02T00:00:00-05:00");
    expect(toOffsetISO(new Date(2026, 6, 1, 9, 5, 7))).toBe("2026-07-01T09:05:07-04:00");
  });
});

describe("derivePetState", () => {
  const cal = (days: [string, number][]) => ({
    days: days.map(([date, count]) => ({ date, count })),
    fetchedAt: now.toISOString(),
    restrictedCount: 0,
  });

  it("counts this week and is idle when active today or yesterday", () => {
    const s = derivePetState(cal([["2026-10-31", 9], ["2026-11-02", 2], ["2026-11-04", 3]]), EMPTY_STATUS, now);
    expect(s).toMatchObject({ count: 5, baseMood: "idle", offline: false });
  });

  it("rests (never sad) after two quiet days", () => {
    expect(derivePetState(cal([["2026-11-02", 4]]), EMPTY_STATUS, now).baseMood).toBe("resting");
  });

  it("shows offline but keeps the last known plant", () => {
    const s = derivePetState(cal([["2026-11-05", 1]]), { ...EMPTY_STATUS, error: "offline" }, now);
    expect(s).toMatchObject({ count: 1, offline: true });
  });
});
