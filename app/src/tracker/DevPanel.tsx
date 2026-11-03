// Dev-only controls for previewing every state without waiting for real activity.
import { useEffect, useState } from "react";
import { STAGES, stageFor } from "../lib/growth";
import { DEFAULT_PET_STATE, celebrate, loadPetState, publishPetState, type PetState } from "../lib/petState";

export function DevPanel() {
  const [pet, setPet] = useState<PetState>(DEFAULT_PET_STATE);

  useEffect(() => {
    loadPetState().then(setPet);
  }, []);

  const update = (patch: Partial<PetState>) => {
    const next = { ...pet, ...patch };
    setPet(next);
    publishPetState(next);
  };

  return (
    <section className="stack">
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
        <div className="row">
          <span>Resting (no recent activity)</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={pet.baseMood === "resting"}
            onChange={(e) => update({ baseMood: e.target.checked ? "resting" : "idle" })}
          />
        </div>
        <div className="row">
          <span>Offline</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={pet.offline}
            onChange={(e) => update({ offline: e.target.checked })}
          />
        </div>
        <div className="row">
          <span>Unread message</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={pet.hasMessage}
            onChange={(e) => update({ hasMessage: e.target.checked })}
          />
        </div>
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
