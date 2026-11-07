import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import { getAccount, setPlantStyle, type Account } from "../lib/data";
import { GitHubError, startDeviceFlow, waitForToken, type DeviceCode } from "../lib/github";
import { currentPetState, DEFAULT_PET_STATE, petView, type PetState } from "../lib/petState";
import { useRoute } from "../lib/route";
import { KeychainError, setSecret } from "../lib/secrets";
import {
  finishOnboarding,
  setAutostart,
  setPetScale,
  type OnboardingStep,
} from "../lib/settings";
import { syncOnce } from "../lib/sync";
import { PairForm } from "../PairForm";
import { PetPreview } from "../pet/PetPreview";
import type { PlantStyle } from "../pet/sprite";
import { PlantPicker, SizePicker, Toggle } from "../ui";

export function Onboarding() {
  const [step, setStep] = useRoute<OnboardingStep>("welcome");
  // Opened straight at the GitHub step = reconnecting/switching accounts, not first run.
  const [reconnect] = useState(window.__ROUTE__ === "github");

  return (
    <div className="onboarding">
      {step === "welcome" && <Welcome onNext={() => setStep("github")} />}
      {step === "github" && (
        <ConnectGitHub onNext={() => (reconnect ? finishOnboarding() : setStep("pair"))} />
      )}
      {step === "pair" && <PairMessages onNext={() => setStep("prefs")} />}
      {step === "prefs" && <Prefs onNext={() => setStep("done")} />}
      {step === "done" && <Done />}
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <section className="step">
      <PetPreview view={petView(DEFAULT_PET_STATE, "happy")} scale={4} />
      <h1>Hi! I'm your desk plant.</h1>
      <p>
        I grow as you make contributions on GitHub. Every Sunday I start over as a fresh seed, and
        I grow a little more with each contribution that week.
      </p>
      <p className="muted">I never wilt. A quiet week is just a rest.</p>
      <button className="button primary" onClick={onNext}>
        Get started
      </button>
    </section>
  );
}

type GitHubPhase =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "waiting"; code: DeviceCode }
  | { phase: "finishing" }
  | { phase: "connected"; account: Account | null }
  | { phase: "error"; message: string };

const ERROR_TEXT: Record<string, string> = {
  denied: "No problem. You can connect whenever you're ready.",
  expired: "That code expired. Let's get a fresh one.",
  offline: "Couldn't reach GitHub. Check your internet connection and try again.",
  keychain: "Couldn't save your login to the Keychain. If macOS asks for access, click Allow, then try again.",
};

function ConnectGitHub({ onNext }: { onNext: () => void }) {
  const [state, setState] = useState<GitHubPhase>({ phase: "idle" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const connect = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ phase: "starting" });
    try {
      const code = await startDeviceFlow();
      setState({ phase: "waiting", code });
      const token = await waitForToken(code, controller.signal);
      setState({ phase: "finishing" });
      await setSecret("github_token", token);
      await syncOnce(); // fill in the account + this week's activity before the pet appears
      setState({ phase: "connected", account: await getAccount() });
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error("connect failed", e);
      const kind = e instanceof GitHubError ? e.kind : e instanceof KeychainError ? "keychain" : "unknown";
      setState({ phase: "error", message: ERROR_TEXT[kind] ?? "Something went wrong connecting to GitHub. Try again?" });
    }
  };

  const cancel = () => {
    abort.current?.abort();
    setState({ phase: "idle" });
  };

  const copyAndOpen = async (code: DeviceCode) => {
    await navigator.clipboard.writeText(code.userCode).catch(() => {});
    await openUrl(code.verificationUri);
  };

  return (
    <section className="step">
      <h1>Connect GitHub</h1>

      {(state.phase === "idle" || state.phase === "starting") && (
        <>
          <p>So I can see your contributions and grow along with you.</p>
          <p className="muted small">
            Desk Pet only asks to read your profile and contribution graph. It can't see your code
            or change anything.
          </p>
          <button className="button primary" disabled={state.phase === "starting"} onClick={connect}>
            {state.phase === "starting" ? "Just a sec…" : "Connect GitHub"}
          </button>
        </>
      )}

      {state.phase === "waiting" && (
        <>
          <p>Enter this code on GitHub:</p>
          <p className="device-code">{state.code.userCode}</p>
          <button className="button primary" onClick={() => copyAndOpen(state.code)}>
            Copy code & open GitHub
          </button>
          <p className="muted small waiting">Waiting for you to approve on GitHub…</p>
          <button className="link" onClick={cancel}>
            Cancel
          </button>
        </>
      )}

      {state.phase === "finishing" && <p className="muted">Connected! Checking on your plant…</p>}

      {state.phase === "connected" && (
        <>
          {state.account ? (
            <div className="account">
              <img src={state.account.avatarUrl} alt="" />
              <span>
                Connected as <strong>@{state.account.login}</strong>
              </span>
            </div>
          ) : (
            <p>Connected! I'll fetch your activity as soon as I can reach GitHub.</p>
          )}
          <button className="button primary" onClick={onNext}>
            Continue
          </button>
        </>
      )}

      {state.phase === "error" && (
        <>
          <p>{state.message}</p>
          <button className="button primary" onClick={connect}>
            Try again
          </button>
        </>
      )}
    </section>
  );
}

function PairMessages({ onNext }: { onNext: () => void }) {
  const [paired, setPaired] = useState<{ name: string | null } | null>(null);

  if (paired) {
    return (
      <section className="step">
        <PetPreview view={{ ...petView(DEFAULT_PET_STATE, "happy"), hasNote: true }} scale={4} />
        <h1>Paired!</h1>
        <p>
          {paired.name ? `Notes for ${paired.name} ` : "Notes "}
          will arrive by your plant. Look for the little envelope.
        </p>
        <button className="button primary" onClick={onNext}>
          Continue
        </button>
      </section>
    );
  }

  return (
    <section className="step">
      <PetPreview view={{ ...petView(DEFAULT_PET_STATE, "idle"), hasNote: true }} scale={4} />
      <h1>Got a pairing code?</h1>
      <p>
        Someone who cares about you can send little notes to your plant. If they gave you a code,
        enter it here.
      </p>
      <PairForm onPaired={(name) => setPaired({ name })} />
      <button className="link" onClick={onNext}>
        Skip for now
      </button>
      <p className="muted small">You can pair later in Settings → Messages.</p>
    </section>
  );
}

function Prefs({ onNext }: { onNext: () => void }) {
  const [openAtLogin, setOpenAtLogin] = useState(true);
  const [scale, setScale] = useState(4);
  const [plant, setPlant] = useState<PlantStyle>("blossom");

  const save = async () => {
    // Dev builds never register themselves as a login item.
    if (!import.meta.env.DEV) await setAutostart(openAtLogin).catch(() => {});
    await setPetScale(scale).catch(() => {});
    await setPlantStyle(plant);
    onNext();
  };

  return (
    <section className="step">
      <h1>Pick your plant</h1>
      <PlantPicker value={plant} onChange={setPlant} />
      <div className="card stack wide">
        <Toggle
          label="Open at login"
          hint={
            import.meta.env.DEV
              ? "Not applied in dev builds."
              : "Brings your plant back after you restart your Mac."
          }
          checked={openAtLogin}
          onChange={setOpenAtLogin}
        />
        <SizePicker value={scale} onChange={setScale} />
      </div>
      <p className="muted small">You can change these any time in Settings.</p>
      <button className="button primary" onClick={save}>
        Continue
      </button>
    </section>
  );
}

function Done() {
  const [pet, setPet] = useState<PetState>(DEFAULT_PET_STATE);
  useEffect(() => {
    currentPetState().then(setPet);
  }, []);

  return (
    <section className="step">
      <PetPreview view={petView(pet, "happy")} scale={4} />
      <h1>Your plant is ready!</h1>
      <p>
        It lives in the corner of your screen. Drag it anywhere you like, or double-click it to see
        your activity.
      </p>
      <p className="muted small">
        Settings and Quit are in the menu bar: look for the little pot at the top of your screen.
      </p>
      <button className="button primary" onClick={() => finishOnboarding()}>
        Show my plant
      </button>
    </section>
  );
}
