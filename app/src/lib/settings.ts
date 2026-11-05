// App settings are owned by the Rust side (it also drives the tray menu);
// these are thin wrappers around its commands.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface Settings {
  petVisible: boolean;
  alwaysOnTop: boolean;
  petScale: number;
  autostart: boolean;
}

export const PET_SIZES = [
  { label: "Small", scale: 3 },
  { label: "Medium", scale: 4 },
  { label: "Large", scale: 5 },
] as const;

export type TrackerTab = "activity" | "messages" | "settings" | "dev";

export const getSettings = () => invoke<Settings>("get_settings");
export const setPetVisible = (visible: boolean) => invoke("set_pet_visible", { visible });
export const setAlwaysOnTop = (enabled: boolean) => invoke("set_always_on_top", { enabled });
export const setPetScale = (scale: number) => invoke("set_pet_scale", { scale });
export const setAutostart = (enabled: boolean) => invoke("set_autostart", { enabled });
export const openTracker = (tab: TrackerTab) => invoke("open_tracker", { tab });

export type OnboardingStep = "welcome" | "github" | "pair" | "prefs" | "done";
/** "github" alone = reconnect flow: finishes right after connecting. */
export const openOnboarding = (step: OnboardingStep) => invoke("open_onboarding", { step });
export const finishOnboarding = () => invoke("finish_onboarding");
export const resetApp = () => invoke("reset_app");
export const showPetMenu = () => invoke("show_pet_menu");
/** W*H string of 0/1: where the pet window should catch clicks (see sprite.hitMask). */
export const setHitMask = (mask: string) => invoke("set_hit_mask", { mask });
export const quitApp = () => invoke("quit_app");

export const onSettingsChanged = (cb: () => void) => listen("settings-changed", cb);
