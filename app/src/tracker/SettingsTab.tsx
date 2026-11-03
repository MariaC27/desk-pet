import { useEffect, useState } from "react";
import {
  PET_SIZES,
  getSettings,
  onSettingsChanged,
  quitApp,
  setAlwaysOnTop,
  setAutostart,
  setPetScale,
  setPetVisible,
  type Settings,
} from "../lib/settings";

function Toggle({
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

export function SettingsTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => getSettings().then(setS);
    refresh();
    const unlisten = onSettingsChanged(refresh);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const run = (p: Promise<unknown>) =>
    p.then(() => setError(null)).catch(() => setError("That setting couldn't be changed. Try again?"));

  if (!s) return null;

  return (
    <section className="stack">
      <div className="card stack">
        <h2>Pet</h2>
        <Toggle label="Show pet on desktop" checked={s.petVisible} onChange={(v) => run(setPetVisible(v))} />
        <Toggle
          label="Keep above other windows"
          checked={s.alwaysOnTop}
          onChange={(v) => run(setAlwaysOnTop(v))}
        />
        <div className="row">
          <span>Size</span>
          <div className="segmented">
            {PET_SIZES.map((size) => (
              <button
                key={size.scale}
                className={s.petScale === size.scale ? "active" : ""}
                onClick={() => run(setPetScale(size.scale))}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <h2>App</h2>
        <Toggle
          label="Open at login"
          hint="Brings your plant back after you restart your Mac."
          checked={s.autostart}
          onChange={(v) => run(setAutostart(v))}
        />
        <div className="row">
          <span className="stack tight">
            <span>Quit Desk Pet</span>
            <span className="muted small">Reopen it any time from Applications.</span>
          </span>
          <button className="button" onClick={() => quitApp()}>
            Quit
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <p className="muted small center">
        To remove Desk Pet completely, quit it and drag it from Applications to the Trash.
      </p>
    </section>
  );
}
