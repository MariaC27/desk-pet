import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import {
  EMPTY_STATUS,
  notifyDataChanged,
  setAccount,
  setCalendar,
  setNotifyMessages,
  setPlantStyle,
  setSyncStatus,
  type UpdateInfo,
} from "../lib/data";
import { syncStatusText } from "../lib/format";
import { unpair } from "../lib/messages";
import { deleteSecret } from "../lib/secrets";
import { checkForUpdate, installUpdate } from "../lib/updates";
import {
  getSettings,
  onSettingsChanged,
  openOnboarding,
  quitApp,
  resetApp,
  setAlwaysOnTop,
  setAutostart,
  setPetScale,
  setPetVisible,
  type Settings,
} from "../lib/settings";
import { PairForm } from "../PairForm";
import { PlantPicker, SizePicker, Toggle } from "../ui";
import { useAppData } from "./useAppData";

async function disconnectGitHub() {
  await deleteSecret("github_token");
  await setAccount(null);
  await setCalendar(null);
  await setSyncStatus({ ...EMPTY_STATUS, error: "not_connected" });
  await notifyDataChanged();
}

export function SettingsTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const data = useAppData();

  useEffect(() => {
    const refresh = () => getSettings().then(setS);
    refresh();
    const unlisten = onSettingsChanged(refresh);
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const run = (p: Promise<unknown>) =>
    p.then(() => setError(null)).catch(() => setError("That didn't work. Try again?"));

  if (!s || !data) return null;
  const { account, status, pairing, notifyMessages } = data;
  const paired = pairing && !pairing.error;
  const pairedOn = pairing?.pairedAt
    ? new Date(pairing.pairedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <section className="stack">
      <div className="card stack">
        <h2>GitHub</h2>
        {account ? (
          <>
            <div className="row">
              <div className="account">
                <img src={account.avatarUrl} alt="" />
                <span className="stack tight">
                  <strong>@{account.login}</strong>
                  <span className="muted small">{syncStatusText(status)}</span>
                </span>
              </div>
              <button
                className="button"
                onClick={() => run(disconnectGitHub().then(() => openOnboarding("github")))}
              >
                Disconnect
              </button>
            </div>
            <p className="muted small">
              Disconnecting removes your GitHub sign-in from this Mac. To revoke Desk Pet's access
              entirely, go to GitHub → Settings → Applications.
            </p>
          </>
        ) : (
          <div className="row">
            <span className="muted">Not connected</span>
            <button className="button" onClick={() => run(openOnboarding("github"))}>
              Connect GitHub
            </button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h2>Messages</h2>
        {paired ? (
          <>
            <div className="row">
              <span className="stack tight">
                <span>Paired{pairing.recipientName ? ` as ${pairing.recipientName}` : ""}</span>
                {pairedOn && <span className="muted small">Since {pairedOn}</span>}
              </span>
              <button className="button" onClick={() => run(unpair())}>
                Unpair
              </button>
            </div>
            <Toggle
              label="Notify me about new notes"
              checked={notifyMessages}
              onChange={(v) => run(setNotifyMessages(v).then(notifyDataChanged))}
            />
          </>
        ) : (
          <>
            <p className="muted small">
              {pairing?.error === "unpaired"
                ? "This Mac was unpaired. Enter a new code to keep receiving notes."
                : "Got a pairing code from someone? Enter it to receive their notes."}
            </p>
            <PairForm onPaired={() => {}} />
          </>
        )}
      </div>

      <div className="card stack">
        <h2>Pet</h2>
        <PlantPicker value={data.pet.plant} onChange={(p) => run(setPlantStyle(p).then(notifyDataChanged))} />
        <Toggle label="Show pet on desktop" checked={s.petVisible} onChange={(v) => run(setPetVisible(v))} />
        <Toggle
          label="Keep above other windows"
          checked={s.alwaysOnTop}
          onChange={(v) => run(setAlwaysOnTop(v))}
        />
        <SizePicker value={s.petScale} onChange={(scale) => run(setPetScale(scale))} />
      </div>

      <div className="card stack">
        <h2>App</h2>
        <UpdateRow update={data.update} />
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
        <div className="row">
          <span className="stack tight">
            <span>Start over</span>
            <span className="muted small">
              {confirmReset
                ? "This forgets your GitHub connection, message pairing and all settings, then runs setup again."
                : "Reset Desk Pet as if it were freshly installed."}
            </span>
          </span>
          {confirmReset ? (
            <div className="segmented">
              <button onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="danger" onClick={() => run(unpair().catch(() => {}).then(resetApp))}>
                Reset
              </button>
            </div>
          ) : (
            <button className="button" onClick={() => setConfirmReset(true)}>
              Reset…
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <p className="muted small center">
        To remove Desk Pet completely, quit it and drag it from Applications to the Trash.
      </p>
    </section>
  );
}

type UpdatePhase =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "upToDate" }
  | { phase: "installing"; progress: number | null }
  | { phase: "error"; message: string };

/** Current version, and an "Install & Restart" button when there's a newer one. Never installs on its own. */
function UpdateRow({ update }: { update: UpdateInfo | null }) {
  const [version, setVersion] = useState("");
  const [state, setState] = useState<UpdatePhase>({ phase: "idle" });
  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  const check = async () => {
    setState({ phase: "checking" });
    try {
      const found = await checkForUpdate();
      setState(found ? { phase: "idle" } : { phase: "upToDate" });
    } catch {
      setState({ phase: "error", message: "Couldn't check for updates. Try again later?" });
    }
  };

  const install = async () => {
    setState({ phase: "installing", progress: null });
    try {
      // Re-check first so the update is loaded even if the app restarted since it was found.
      if (!(await checkForUpdate())) return setState({ phase: "upToDate" });
      await installUpdate((progress) => setState({ phase: "installing", progress }));
    } catch {
      setState({ phase: "error", message: "The update didn't install. Try again?" });
    }
  };

  if (state.phase === "installing") {
    const pct = state.progress === null ? null : Math.round(state.progress * 100);
    return (
      <div className="row">
        <span className="stack tight">
          <span>Updating to {update?.version}…</span>
          <span className="muted small">
            {pct === null ? "Downloading" : pct < 100 ? `Downloading · ${pct}%` : "Installing"}. Desk Pet
            restarts when it's done.
          </span>
        </span>
      </div>
    );
  }

  if (update) {
    return (
      <div className="stack tight">
        <div className="row">
          <span className="stack tight">
            <span>Desk Pet {update.version} is available</span>
            <span className="muted small">You have {version}. Your plant and settings stay as they are.</span>
          </span>
          <button className="button primary" onClick={install}>
            Install &amp; Restart
          </button>
        </div>
        {update.notes && <p className="muted small update-notes">{update.notes}</p>}
        {state.phase === "error" && <p className="error small">{state.message}</p>}
      </div>
    );
  }

  return (
    <div className="row">
      <span className="stack tight">
        <span>Version {version}</span>
        <span className={state.phase === "error" ? "error small" : "muted small"}>
          {state.phase === "upToDate"
            ? "You're up to date."
            : state.phase === "error"
              ? state.message
              : "Desk Pet checks for updates and lets you know. Nothing installs on its own."}
        </span>
      </span>
      <button className="button" disabled={state.phase === "checking"} onClick={check}>
        {state.phase === "checking" ? "Checking…" : "Check for Updates"}
      </button>
    </div>
  );
}
