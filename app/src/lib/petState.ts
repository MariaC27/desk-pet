// The state the pet renders from. For now the dev panel writes it; Phase 2's
// GitHub sync will compute it from the contribution calendar instead.
import { emit, listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";

export interface PetState {
  count: number; // contributions this week
  baseMood: "idle" | "resting";
  offline: boolean;
  hasMessage: boolean;
}

export const DEFAULT_PET_STATE: PetState = {
  count: 0,
  baseMood: "idle",
  offline: false,
  hasMessage: false,
};

const KEY = "petState";
const store = () => load("settings.json", { autoSave: 200 });

export async function loadPetState(): Promise<PetState> {
  const saved = await (await store()).get<Partial<PetState>>(KEY);
  return { ...DEFAULT_PET_STATE, ...saved };
}

/** Persist and broadcast to every window. */
export async function publishPetState(state: PetState) {
  await (await store()).set(KEY, state);
  await emit("pet:state", state);
}

export const onPetState = (cb: (s: PetState) => void) =>
  listen<PetState>("pet:state", (e) => cb(e.payload));

export const celebrate = () => emit("pet:celebrate");
export const onCelebrate = (cb: () => void) => listen("pet:celebrate", cb);
