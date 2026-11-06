import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCALE,
  dayLevels,
  extraBloomsFor,
  scaleFromHistory,
  localDateKey,
  stageFor,
  startOfNextWeek,
  startOfWeek,
  toNextStage,
  weekCount,
} from "./growth";

describe("stageFor", () => {
  it("maps weekly counts to stages", () => {
    expect([0, 1, 2, 3, 5, 6, 10, 15, 21, 22, 29, 30, 99].map((n) => stageFor(n))).toEqual([
      0, 1, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7,
    ]);
  });

  it("adds extra blooms past full bloom, capped", () => {
    expect([29, 30, 34, 35, 40, 200].map((n) => extraBloomsFor(n))).toEqual([0, 0, 0, 1, 2, 4]);
  });

  it("reports distance to the next stage", () => {
    expect(toNextStage(0)).toBe(1);
    expect(toNextStage(4)).toBe(2);
    expect(toNextStage(30)).toBeNull();
  });
});

describe("personal growth scale", () => {
  const now = new Date(2026, 10, 5, 12, 0); // Thu Nov 5 2026; week started Sun Nov 1
  /** One day per past week (each Monday), newest week last, plus this week's days. */
  const history = (weekly: number[], thisWeek = 0) => {
    const days = weekly.map((count, i) => {
      const d = new Date(2026, 10, 2 - 7 * (weekly.length - i));
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, count };
    });
    return [...days, { date: "2026-11-02", count: thisWeek }];
  };

  it("falls back to the default with too little history", () => {
    expect(scaleFromHistory(history([40, 50, 0, 0]), now)).toEqual(DEFAULT_SCALE);
  });

  it("scales a heavy contributor up so full bloom takes a good week for them", () => {
    const scale = scaleFromHistory(history([100, 150, 0, 200, 250, 300]), now);
    expect(scale.personalized).toBe(true);
    expect(scale.thresholds).toEqual([0, 1, 25, 50, 83, 125, 183, 250]);
    expect(stageFor(30, scale)).toBe(2); // a big week for most people is a seedling here
    expect(stageFor(260, scale)).toBe(7);
  });

  it("scales a light contributor down, one contribution per stage at minimum", () => {
    const scale = scaleFromHistory(history([1, 2, 3, 2, 1]), now);
    expect(scale.thresholds).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("ignores the current week, so the scale doesn't move mid-week", () => {
    const base = history([10, 20, 30, 40]);
    const busy = history([10, 20, 30, 40], 500);
    expect(scaleFromHistory(busy, now)).toEqual(scaleFromHistory(base, now));
  });

  it("shades the heatmap relative to their own busy days", () => {
    const level = dayLevels([1, 2, 3, 4, 50, 60, 70, 80].map((count, i) => ({ date: `2026-10-0${i + 1}`, count })));
    expect([0, 1, 4, 60, 80].map(level)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("week boundaries (Sunday start, local time)", () => {
  it("Saturday 11:59 PM still belongs to the week that started the previous Sunday", () => {
    const saturday = new Date(2026, 10, 7, 23, 59); // Sat Nov 7 2026
    expect(localDateKey(startOfWeek(saturday))).toBe("2026-11-01");
  });

  it("Sunday 12:00 AM starts a new week", () => {
    const sunday = new Date(2026, 10, 8, 0, 0);
    expect(localDateKey(startOfWeek(sunday))).toBe("2026-11-08");
  });

  it("next week starts 7 days later, across a month boundary", () => {
    expect(localDateKey(startOfNextWeek(new Date(2026, 10, 25)))).toBe("2026-11-29");
  });

  it("sums only the current week", () => {
    const days = [
      { date: "2026-10-31", count: 9 }, // previous Saturday
      { date: "2026-11-01", count: 2 },
      { date: "2026-11-04", count: 3 },
      { date: "2026-11-07", count: 1 },
      { date: "2026-11-08", count: 7 }, // next Sunday
    ];
    expect(weekCount(days, new Date(2026, 10, 7, 23, 59))).toBe(6);
    expect(weekCount(days, new Date(2026, 10, 8, 0, 0))).toBe(7);
  });
});
