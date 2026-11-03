import { useEffect, useState } from "react";
import { STAGES, stageFor, startOfNextWeek, startOfWeek, toNextStage } from "../lib/growth";
import { DEFAULT_PET_STATE, loadPetState, onPetState, type PetState } from "../lib/petState";
import { PetPreview } from "../pet/PetPreview";

const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function ActivityTab() {
  const [pet, setPet] = useState<PetState>(DEFAULT_PET_STATE);

  useEffect(() => {
    loadPetState().then(setPet);
    const unlisten = onPetState(setPet);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const now = new Date();
  const weekEnd = startOfNextWeek(now);
  weekEnd.setDate(weekEnd.getDate() - 1);
  const stage = stageFor(pet.count);
  const remaining = toNextStage(pet.count);
  const from = STAGES[stage].min;
  const to = STAGES[stage + 1]?.min ?? from;
  const progress = remaining === null ? 1 : (pet.count - from) / (to - from);

  return (
    <section className="stack">
      <div className="card hero">
        <PetPreview view={{ ...pet, mood: pet.baseMood }} scale={3} />
        <div className="stack tight">
          <p className="eyebrow">
            This week · {fmt.format(startOfWeek(now))} – {fmt.format(weekEnd)}
          </p>
          <h1>{STAGES[stage].name}</h1>
          <p className="big-number">
            {pet.count} <span>contribution{pet.count === 1 ? "" : "s"}</span>
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

      <div className="card">
        <h2>How it grows</h2>
        <p className="muted">
          Your plant starts as a seed every Monday at midnight and grows as you make contributions
          during the week. It never wilts. A quiet week is just a resting week.
        </p>
      </div>

      <div className="card empty">
        <p>GitHub isn't connected yet.</p>
        <p className="muted">Daily history and milestones will show up here once it is.</p>
      </div>
    </section>
  );
}
