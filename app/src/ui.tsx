// Small shared UI pieces for the tracker and onboarding windows.
import { PET_SIZES } from "./lib/settings";

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
