// Dev-only controls for previewing every state without waiting for real activity.
// Any change here overrides the real GitHub data until "Use real data" is pressed.
import { useEffect, useState } from "react";
import { getDevOverride, notifyDataChanged, requestMessageCheck, requestSync, setDevOverride } from "../lib/data";
import { STAGES, stageFor } from "../lib/growth";
import { DEFAULT_PET_STATE, celebrate, currentPetState, type PetState } from "../lib/petState";
import { unpair } from "../lib/messages";
import { openTracker } from "../lib/settings";
import { Toggle } from "../ui";
import { useAppData } from "./useAppData";

export function DevPanel() {
  const [pet, setPet] = useState<PetState>(DEFAULT_PET_STATE);
  const [overriding, setOverriding] = useState(false);
  const data = useAppData();
  const pairing = data?.pairing;
  const unread = data?.messages.filter((m) => !m.readAt).length ?? 0;

  const load = async () => {
    setOverriding(!!(await getDevOverride()));
    setPet(await currentPetState());
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (patch: Partial<PetState>) => {
    const next = { ...pet, ...patch };
    setPet(next);
    setOverriding(true);
    await setDevOverride(next);
    await notifyDataChanged();
  };

  const useRealData = async () => {
    await setDevOverride(null);
    await notifyDataChanged();
    await load();
  };

  return (
    <section className="stack">
      <div className={overriding ? "banner" : "banner quiet"}>
        <span>{overriding ? "Showing fake data on the pet." : "Showing real GitHub data."}</span>
        {overriding && (
          <button className="button" onClick={useRealData}>
            Use real data
          </button>
        )}
      </div>

      <div className="card stack">
        <h2>Messages</h2>
        <p className="muted small">
          {!pairing
            ? "Not paired. On the sender page, add a \"Me (test)\" recipient, get a code, and enter it in Settings → Messages."
            : pairing.error
              ? "Unpaired by the server (removed on the sender page)."
              : `Paired as ${pairing.recipientName ?? "?"} · ${data?.messages.length ?? 0} notes, ${unread} unread`}
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
            {pet.count} <span>· {STAGES[stageFor(pet.count)].name}</span>
          </span>
          <div className="segmented">
            <button onClick={() => update({ count: Math.max(0, pet.count - 1) })}>−1</button>
            <button onClick={() => update({ count: pet.count + 1 })}>+1</button>
            <button onClick={() => update({ count: pet.count + 5 })}>+5</button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={55}
          value={pet.count}
          onChange={(e) => update({ count: Number(e.target.value) })}
        />
        <div className="chips">
          {STAGES.map((s) => (
            <button key={s.name} className="chip" onClick={() => update({ count: s.min })}>
              {s.name}
            </button>
          ))}
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
        <Toggle label="Unread message" checked={pet.hasMessage} onChange={(v) => update({ hasMessage: v })} />
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
