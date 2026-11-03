import { describe, expect, it } from "vitest";
import {
  extraBloomsFor,
  localDateKey,
  stageFor,
  startOfNextWeek,
  startOfWeek,
  toNextStage,
  weekCount,
} from "./growth";

describe("stageFor", () => {
  it("maps weekly counts to stages", () => {
    expect([0, 1, 2, 3, 5, 6, 10, 15, 21, 22, 29, 30, 99].map(stageFor)).toEqual([
      0, 1, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7,
    ]);
  });

  it("adds extra blooms past full bloom, capped", () => {
    expect([29, 30, 34, 35, 40, 200].map(extraBloomsFor)).toEqual([0, 0, 0, 1, 2, 4]);
  });

  it("reports distance to the next stage", () => {
    expect(toNextStage(0)).toBe(1);
    expect(toNextStage(4)).toBe(2);
    expect(toNextStage(30)).toBeNull();
  });
});

describe("week boundaries (Monday start, local time)", () => {
  it("Sunday 11:59 PM still belongs to the week that started the previous Monday", () => {
    const sunday = new Date(2026, 10, 8, 23, 59); // Sun Nov 8 2026
    expect(localDateKey(startOfWeek(sunday))).toBe("2026-11-02");
  });

  it("Monday 12:00 AM starts a new week", () => {
    const monday = new Date(2026, 10, 9, 0, 0);
    expect(localDateKey(startOfWeek(monday))).toBe("2026-11-09");
  });

  it("next week starts 7 days later, across a month boundary", () => {
    expect(localDateKey(startOfNextWeek(new Date(2026, 10, 25)))).toBe("2026-11-30");
  });

  it("sums only the current week", () => {
    const days = [
      { date: "2026-11-01", count: 9 }, // previous Sunday
      { date: "2026-11-02", count: 2 },
      { date: "2026-11-05", count: 3 },
      { date: "2026-11-08", count: 1 },
      { date: "2026-11-09", count: 7 }, // next Monday
    ];
    expect(weekCount(days, new Date(2026, 10, 8, 23, 59))).toBe(6);
    expect(weekCount(days, new Date(2026, 10, 9, 0, 0))).toBe(7);
  });
});
