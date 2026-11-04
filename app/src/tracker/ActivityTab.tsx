import { useEffect, useState } from "react";
import { HISTORY_WEEKS } from "../lib/config";
import { onDataChanged, requestSync, type SyncStatus } from "../lib/data";
import { syncStatusText } from "../lib/format";
import { STAGES, localDateKey, stageFor, startOfWeek, toNextStage, type CalendarDay } from "../lib/growth";
import type { PetState } from "../lib/petState";
import { openOnboarding } from "../lib/settings";
import { PetPreview } from "../pet/PetPreview";
import { useAppData } from "./useAppData";

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function level(count: number) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function ActivityTab() {
  const data = useAppData();
  if (!data) return null;
  const { calendar, status, pet } = data;
  const now = new Date();
  const counts = new Map((calendar?.days ?? []).map((d: CalendarDay) => [d.date, d.count]));

  return (
    <section className="stack">
      <StatusBanner status={status} />
      <ThisWeek count={pet.count} pet={pet} now={now} />
      {calendar && (
        <div className="card graphs">
          <WeekDays counts={counts} now={now} />
          <History counts={counts} now={now} />
        </div>
      )}
      <Footer status={status} restrictedCount={calendar?.restrictedCount ?? 0} />
    </section>
  );
}

function StatusBanner({ status }: { status: SyncStatus }) {
  switch (status.error) {
    case "not_connected":
      return (
        <div className="banner">
          <span>Connect GitHub so your plant can start growing.</span>
          <button className="button" onClick={() => openOnboarding("github")}>
            Connect
          </button>
        </div>
      );
    case "auth":
      return (
        <div className="banner">
          <span>Your GitHub connection expired. Reconnect to keep growing.</span>
          <button className="button" onClick={() => openOnboarding("github")}>
            Reconnect
          </button>
        </div>
      );
    case "offline":
      return (
        <div className="banner quiet">
          Can't reach GitHub right now. Your plant shows your last synced activity.
        </div>
      );
    case "rate_limited":
    case "unknown":
      return <div className="banner quiet">Syncing is paused for a bit. I'll keep trying.</div>;
    default:
      return null;
  }
}

function ThisWeek({ count, pet, now }: { count: number; pet: PetState; now: Date }) {
  const start = startOfWeek(now);
  const stage = stageFor(count);
  const remaining = toNextStage(count);
  const from = STAGES[stage].min;
  const to = STAGES[stage + 1]?.min ?? from;
  const progress = remaining === null ? 1 : (count - from) / (to - from);

  return (
    <div className="card hero">
      <PetPreview view={{ ...pet, mood: pet.baseMood }} scale={3} />
      <div className="stack tight">
        <p className="eyebrow">
          This week · {shortDate.format(start)} – {shortDate.format(addDays(start, 6))}
        </p>
        <h1>{STAGES[stage].name}</h1>
        <p className="big-number">
          {count} <span>contribution{count === 1 ? "" : "s"}</span>
        </p>
        <div className="progress" aria-hidden>
          <div style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="muted">
          {remaining === null
            ? "Full bloom! Anything more adds extra flowers."
            : `${remaining} more to become a ${STAGES[stage + 1].name.toLowerCase()}.`}
        </p>
      </div>
    </div>
  );
}

function WeekDays({ counts, now }: { counts: Map<string, number>; now: Date }) {
  const start = startOfWeek(now);
  const today = localDateKey(now);
  return (
    <div className="stack compact">
      <h2>Day by day</h2>
      <div className="weekdays">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(start, i);
          const key = localDateKey(day);
          const future = key > today;
          const count = counts.get(key) ?? 0;
          return (
            <div key={key} className={`weekday${key === today ? " today" : ""}${future ? " future" : ""}`}>
              <span className="muted small">{weekday.format(day)}</span>
              <span className={`day-count level-${future ? 0 : level(count)}`}>{future ? "" : count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function History({ counts, now }: { counts: Map<string, number>; now: Date }) {
  const first = addDays(startOfWeek(now), -7 * (HISTORY_WEEKS - 1));
  const today = localDateKey(now);
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(first, w * 7 + d);
      const key = localDateKey(day);
      return { key, day, count: counts.get(key) ?? 0, future: key > today };
    }),
  );
  const total = weeks.flat().reduce((n, d) => n + d.count, 0);

  return (
    <div className="stack compact">
      <div className="row">
        <h2>Last {HISTORY_WEEKS} weeks</h2>
        <span className="muted small">{total} contributions</span>
      </div>
      <div className="heatmap" role="img" aria-label={`${total} contributions in the last ${HISTORY_WEEKS} weeks`}>
        {weeks.map((week) => (
          <div key={week[0].key} className="heatmap-week">
            {week.map((d) => (
              <div
                key={d.key}
                className={`cell level-${d.future ? "none" : level(d.count)}`}
                title={d.future ? "" : `${shortDate.format(d.day)}: ${d.count}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer({ status, restrictedCount }: { status: SyncStatus; restrictedCount: number }) {
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!syncing) return;
    const done = () => setSyncing(false);
    const timeout = setTimeout(done, 20_000);
    const unlisten = onDataChanged(done);
    return () => {
      clearTimeout(timeout);
      unlisten.then((f) => f());
    };
  }, [syncing]);

  return (
    <div className="stack">
      {status.error !== "not_connected" && (
        <div className="row muted small">
          <span>{syncing ? "Syncing…" : syncStatusText(status)}</span>
          <button
            className="link"
            disabled={syncing}
            onClick={() => {
              setSyncing(true);
              requestSync();
            }}
          >
            Sync now
          </button>
        </div>
      )}
      <details className="muted small">
        <summary>What counts as a contribution?</summary>
        <p>
          The same things GitHub counts on your profile graph: commits to a repository's main
          branch, pull requests, issues, and code reviews. If private work isn't showing up, turn on
          "Include private contributions on my profile" in your GitHub profile settings.
        </p>
        {restrictedCount > 0 && (
          <p>
            GitHub reports {restrictedCount} private contribution{restrictedCount === 1 ? "" : "s"}{" "}
            in this period without day-by-day detail, so they aren't counted here.
          </p>
        )}
      </details>
    </div>
  );
}
