// Growth rules: the plant resets to a seed at the start of each week
// (Saturday 11:59 PM -> Sunday 12:00 AM, local time) and grows through stages
// as that week's contributions add up. All tunable numbers live here.

/** 0 = Sunday, 1 = Monday. Sunday matches the columns of GitHub's contribution graph. */
export const WEEK_STARTS_ON = 0;

export const STAGES = [
  { name: "Seed", min: 0 },
  { name: "Sprout", min: 1 },
  { name: "Seedling", min: 3 },
  { name: "Young plant", min: 6 },
  { name: "Leafy", min: 10 },
  { name: "Budding", min: 15 },
  { name: "Flowering", min: 22 },
  { name: "Full bloom", min: 30 },
] as const;

export const MAX_STAGE = STAGES.length - 1;

/** Past full bloom: one extra flower per this many contributions. */
export const EXTRA_BLOOM_EVERY = 5;
export const MAX_EXTRA_BLOOMS = 4;
export const LADYBUG_AT = 40;

export function stageFor(count: number): number {
  let stage = 0;
  STAGES.forEach((s, i) => {
    if (count >= s.min) stage = i;
  });
  return stage;
}

export function extraBloomsFor(count: number): number {
  const over = count - STAGES[MAX_STAGE].min;
  if (over < 0) return 0;
  return Math.min(MAX_EXTRA_BLOOMS, Math.floor(over / EXTRA_BLOOM_EVERY));
}

/** Contributions still needed for the next stage, or null at full bloom. */
export function toNextStage(count: number): number | null {
  const next = STAGES[stageFor(count) + 1];
  return next ? next.min - count : null;
}

/** Local midnight at the start of the week containing `date`. */
export function startOfWeek(date: Date, weekStartsOn = WEEK_STARTS_ON): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  day.setDate(day.getDate() - diff);
  return day;
}

export function startOfNextWeek(date: Date, weekStartsOn = WEEK_STARTS_ON): Date {
  const next = startOfWeek(date, weekStartsOn);
  next.setDate(next.getDate() + 7);
  return next;
}

/** "YYYY-MM-DD" for a date in local time (the format GitHub's calendar uses). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO 8601 with the local UTC offset, e.g. "2026-11-02T00:00:00-08:00". */
export function toOffsetISO(date: Date): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${localDateKey(date)}T${time}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  count: number;
}

/** Sum of contributions in the current week. */
export function weekCount(days: CalendarDay[], now = new Date()): number {
  const from = localDateKey(startOfWeek(now));
  const to = localDateKey(startOfNextWeek(now));
  return days
    .filter((d) => d.date >= from && d.date < to)
    .reduce((sum, d) => sum + d.count, 0);
}
