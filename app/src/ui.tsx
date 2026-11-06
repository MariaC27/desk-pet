// Small shared UI pieces for the tracker and onboarding windows.
import { MAX_STAGE } from "./lib/growth";
import { DEFAULT_PET_STATE, petView } from "./lib/petState";
import { PET_SIZES } from "./lib/settings";
import { PetPreview } from "./pet/PetPreview";
import { PLANT_STYLES, type PlantStyle } from "./pet/sprite";

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="row">
      <span className="stack tight">
        <span>{label}</span>
        {hint && <span className="muted small">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function SizePicker({ value, onChange }: { value: number; onChange: (scale: number) => void }) {
  return (
    <div className="row">
      <span>Size</span>
      <div className="segmented">
        {PET_SIZES.map((size) => (
          <button
            key={size.scale}
            className={value === size.scale ? "active" : ""}
            onClick={() => onChange(size.scale)}
          >
            {size.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Choose the plant style, each shown in full bloom. */
export function PlantPicker({ value, onChange }: { value: PlantStyle; onChange: (p: PlantStyle) => void }) {
  return (
    <div className="plant-picker" role="radiogroup" aria-label="Plant">
      {PLANT_STYLES.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={value === p.id}
          className={value === p.id ? "plant-option active" : "plant-option"}
          onClick={() => onChange(p.id)}
        >
          <PetPreview view={{ ...petView(DEFAULT_PET_STATE, "happy"), plant: p.id, stage: MAX_STAGE }} scale={2} />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}
