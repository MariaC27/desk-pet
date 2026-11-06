// Growth rules: the plant resets to a seed at the start of each week
// (Saturday 11:59 PM -> Sunday 12:00 AM, local time) and grows through stages
// as that week's contributions add up. How many contributions each stage
// takes is scaled to the person's own recent history (the weeks we fetch).
// All tunable numbers live here.

/** 0 = Sunday, 1 = Monday. Sunday matches the columns of GitHub's contribution graph. */
export const WEEK_STARTS_ON = 0;

export const STAGE_NAMES = [
  "Seed",
  "Sprout",
  "Seedling",
  "Young plant",
  "Leafy",
  "Budding",
  "Flowering",
  "Full bloom",
] as const;

export const MAX_STAGE = STAGE_NAMES.length - 1;

/**
 * Where each stage starts, as a fraction of the person's full-bloom target.
 * Sprout is always the first contribution, so the plant reacts right away.
 */
const STAGE_FRACTIONS = [0, 0, 0.1, 0.2, 0.33, 0.5, 0.73, 1];

/** Used until there's enough history (and for brand-new GitHub accounts). */
export const DEFAULT_BLOOM_TARGET = 30;

/** Full bloom = the weekly total beaten in about a quarter of their active weeks. */
const BLOOM_PERCENTILE = 0.75;
const MIN_ACTIVE_WEEKS = 4;
/** At least one contribution per stage. */
const MIN_BLOOM_TARGET = MAX_STAGE;

export const MAX_EXTRA_BLOOMS = 4;

export interface GrowthScale {
  /** Minimum weekly count for each stage (length = STAGE_NAMES.length). */
  thresholds: number[];
  /** Past full bloom: one extra flower per this many contributions. */
  bloomEvery: number;
  ladybugAt: number;
  /** True when based on their history rather than the default. */
  personalized: boolean;
}

export function scaleForTarget(target: number, personalized = false): GrowthScale {
  const bloom = Math.max(MIN_BLOOM_TARGET, Math.round(target));
  const thresholds = STAGE_FRACTIONS.map((f) => Math.round(bloom * f));
  thresholds[1] = 1;
  for (let i = 2; i < thresholds.length; i++) thresholds[i] = Math.max(thresholds[i], thresholds[i - 1] + 1);
  const bloomEvery = Math.max(1, Math.round(bloom / 6));
  return { thresholds, bloomEvery, ladybugAt: thresholds[MAX_STAGE] + 2 * bloomEvery, personalized };
}

export const DEFAULT_SCALE = scaleForTarget(DEFAULT_BLOOM_TARGET);

/** Weekly totals for completed weeks before the current one, oldest first. */
export function pastWeekTotals(days: CalendarDay[], now = new Date()): number[] {
  const current = localDateKey(startOfWeek(now));
  const totals = new Map<string, number>();
  for (const d of days) {
    if (d.date >= current) continue;
    const [y, m, dd] = d.date.split("-").map(Number);
    const week = localDateKey(startOfWeek(new Date(y, m - 1, dd)));
    totals.set(week, (totals.get(week) ?? 0) + d.count);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, n]) => n);
}

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

/**
 * The person's own scale, from completed weeks only, so it stays fixed for
 * the whole current week and is recalculated each Sunday.
 */
export function scaleFromHistory(days: CalendarDay[], now = new Date()): GrowthScale {
  const active = pastWeekTotals(days, now)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (active.length < MIN_ACTIVE_WEEKS) return DEFAULT_SCALE;
  return scaleForTarget(percentile(active, BLOOM_PERCENTILE), true);
}

export function stageFor(count: number, scale = DEFAULT_SCALE): number {
  let stage = 0;
  scale.thresholds.forEach((min, i) => {
    if (count >= min) stage = i;
  });
  return stage;
}

export function extraBloomsFor(count: number, scale = DEFAULT_SCALE): number {
  const over = count - scale.thresholds[MAX_STAGE];
  if (over < 0) return 0;
  return Math.min(MAX_EXTRA_BLOOMS, Math.floor(over / scale.bloomEvery));
}

/** Contributions still needed for the next stage, or null at full bloom. */
export function toNextStage(count: number, scale = DEFAULT_SCALE): number | null {
  const next = scale.thresholds[stageFor(count, scale) + 1];
  return next === undefined ? null : next - count;
}

/**
 * Heatmap shade (0-4) for a day, relative to their own busy days the way
 * GitHub's graph is: quartiles of the non-zero daily counts.
 */
export function dayLevels(days: CalendarDay[]): (count: number) => number {
  const nonzero = days
    .map((d) => d.count)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (!nonzero.length) return (n) => (n > 0 ? 1 : 0);
  const q = [0.25, 0.5, 0.75].map((p) => percentile(nonzero, p));
  return (n) => (n <= 0 ? 0 : n <= q[0] ? 1 : n <= q[1] ? 2 : n <= q[2] ? 3 : 4);
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
