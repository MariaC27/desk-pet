// Dev-only controls for previewing every state without waiting for real activity.
// Any change here overrides the real data on the pet until "Use real data" is pressed.
import { useEffect, useState } from "react";
import {
  getDevOverride,
  notifyDataChanged,
  requestMessageCheck,
  requestSync,
  setDevOverride,
} from "../lib/data";
import { EMOTIONS } from "../lib/emotions";
import { STAGE_NAMES } from "../lib/growth";
import { unpair } from "../lib/messages";
import { celebrate, type DevOverride } from "../lib/petState";
import { openTracker } from "../lib/settings";
import { Toggle } from "../ui";
import { useAppData } from "./useAppData";

export function DevPanel() {
  const [override, setOverride] = useState<DevOverride | null>(null);
  const data = useAppData();

  useEffect(() => {
    getDevOverride<DevOverride>().then(setOverride);
  }, []);

  if (!data) return null;
  const { pet, pairing, messages } = data;
  const unread = messages.filter((m) => !m.readAt).length;

  const update = async (patch: DevOverride) => {
    const next = { ...override, ...patch };
    setOverride(next);
    await setDevOverride(next);
    await notifyDataChanged();
  };

  const useRealData = async () => {
    setOverride(null);
    await setDevOverride(null);
    await notifyDataChanged();
  };

  return (
    <section className="stack">
      <div className={override ? "banner" : "banner quiet"}>
        <span>{override ? "Showing fake data on the pet." : "Showing real data."}</span>
        {override && (
          <button className="button" onClick={useRealData}>
            Use real data
          </button>
        )}
      </div>

      <div className="card stack">
        <h2>Messages</h2>
        <p className="muted small">
          {!pairing
            ? 'Not paired. On the sender page, add a "Me (test)" recipient, get a code, and enter it in Settings → Messages.'
            : pairing.error
              ? "Unpaired by the server (removed on the sender page)."
              : `Paired as ${pairing.recipientName ?? "?"} · ${messages.length} messages, ${unread} unread`}
        </p>
        <div className="row">
          <button className="button" onClick={() => requestMessageCheck()}>
            Check messages now
          </button>
          <button className="button" onClick={() => requestSync()}>
            Sync GitHub now
          </button>
          {pairing ? (
            <button className="button" onClick={() => unpair()}>
              Unpair
            </button>
          ) : (
            <button className="button" onClick={() => openTracker("settings")}>
              Pair…
            </button>
          )}
        </div>
      </div>

      <div className="card stack">
        <h2>Contributions this week</h2>
        <div className="row">
          <span className="big-number">
            {pet.count} <span>· {STAGE_NAMES[pet.stage]}</span>
          </span>
          <div className="segmented">
            <button onClick={() => update({ count: Math.max(0, pet.count - 1) })}>−1</button>
            <button onClick={() => update({ count: pet.count + 1 })}>+1</button>
            <button onClick={() => update({ count: pet.count + pet.scale.bloomEvery })}>+{pet.scale.bloomEvery}</button>
          </div>
        </div>
        <p className="muted small">
          Stages start at {pet.scale.thresholds.join(" · ")}
          {pet.scale.personalized ? " (from your history)" : " (default)"}
        </p>
        <div className="chips">
          {STAGE_NAMES.map((name, i) => (
            <button key={name} className="chip" onClick={() => update({ count: pet.scale.thresholds[i] })}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h2>Emotion</h2>
        <div className="chips">
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              className={pet.emotion === e.id ? "chip active" : "chip"}
              onClick={() => update({ emotion: e.id, emotionKey: `dev-${Date.now()}` })}
            >
              {e.emoji} {e.label}
            </button>
          ))}
          <button className="chip" onClick={() => update({ emotion: null, emotionKey: null })}>
            None
          </button>
        </div>
      </div>

      <div className="card stack">
        <h2>Mood & overlays</h2>
        <Toggle
          label="Resting (no recent activity)"
          checked={pet.baseMood === "resting"}
          onChange={(v) => update({ baseMood: v ? "resting" : "idle" })}
        />
        <Toggle label="Offline" checked={pet.offline} onChange={(v) => update({ offline: v })} />
        <Toggle label="Unread note (envelope)" checked={pet.hasNote} onChange={(v) => update({ hasNote: v })} />
        <div className="row">
          <button className="button" onClick={() => celebrate()}>
            Celebrate
          </button>
          <button className="button" onClick={() => update({ count: 0 })}>
            Start a new week
          </button>
        </div>
      </div>
    </section>
  );
}
