// What the pet renders from: this week's contributions (scaled to the
// person's own history), the chosen plant, and any unread notes/emotions.
// In dev builds the dev panel can override parts of it to preview states.
import { emit, listen } from "@tauri-apps/api/event";
import { PLANT_STYLES, type Mood, type PetView, type PlantStyle } from "../pet/sprite";
import {
  getCalendar,
  getDevOverride,
  getMessages,
  getPlantStyle,
  getSyncStatus,
  type CalendarCache,
  type Message,
  type SyncStatus,
} from "./data";
import type { Emotion } from "./emotions";
import {
  DEFAULT_SCALE,
  MAX_STAGE,
  extraBloomsFor,
  localDateKey,
  scaleFromHistory,
  stageFor,
  weekCount,
  type GrowthScale,
} from "./growth";

export interface PetState {
  plant: PlantStyle;
  count: number; // contributions this week
  scale: GrowthScale;
  stage: number;
  extraBlooms: number;
  ladybug: boolean;
  baseMood: "idle" | "resting";
  offline: boolean;
  hasNote: boolean; // unread message with text
  emotion: Emotion | null; // from the newest unread message that has one
  /** Identifies the emotion's message, so the pet knows when a new one arrives. */
  emotionKey: string | null;
}

/** What the dev panel can fake. */
export type DevOverride = Partial<Pick<PetState, "count" | "baseMood" | "offline" | "hasNote" | "emotion" | "emotionKey">>;

function withCount(state: Omit<PetState, "stage" | "extraBlooms" | "ladybug">): PetState {
  const { count, scale } = state;
  const stage = stageFor(count, scale);
  return {
    ...state,
    stage,
    extraBlooms: extraBloomsFor(count, scale),
    ladybug: stage === MAX_STAGE && count >= scale.ladybugAt,
  };
}

export const DEFAULT_PET_STATE: PetState = withCount({
  plant: "blossom",
  count: 0,
  scale: DEFAULT_SCALE,
  baseMood: "idle",
  offline: false,
  hasNote: false,
  emotion: null,
  emotionKey: null,
});

export function derivePetState(
  cal: CalendarCache | null,
  status: SyncStatus,
  now = new Date(),
  messages: Message[] = [],
  plant: PlantStyle = "blossom",
): PetState {
  const unread = messages.filter((m) => !m.readAt);
  const feeling = [...unread].reverse().find((m) => m.mood);
  const common = {
    plant,
    offline: status.error === "offline",
    hasNote: unread.some((m) => m.body.trim().length > 0),
    emotion: feeling?.mood ?? null,
    emotionKey: feeling?.id ?? null,
  };
  if (!cal) return { ...DEFAULT_PET_STATE, ...common };

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const recentDays = [localDateKey(now), localDateKey(yesterday)];
  const recent = cal.days.filter((d) => recentDays.includes(d.date)).reduce((n, d) => n + d.count, 0);

  return withCount({
    ...common,
    count: weekCount(cal.days, now),
    scale: scaleFromHistory(cal.days, now),
    baseMood: recent > 0 ? "idle" : "resting",
  });
}

export async function currentPetState(now = new Date()): Promise<PetState> {
  const [cal, status, messages, plant] = await Promise.all([getCalendar(), getSyncStatus(), getMessages(), getPlantStyle()]);
  const real = derivePetState(cal, status, now, messages, PLANT_STYLES.some((p) => p.id === plant) ? plant : "blossom");
  const override = import.meta.env.DEV ? await getDevOverride<DevOverride>() : null;
  return override ? withCount({ ...real, ...override }) : real;
}

/** Sprite view of a pet state, optionally with a different face. */
export function petView(state: PetState, mood: Mood = state.baseMood): PetView {
  return {
    plant: state.plant,
    stage: state.stage,
    extraBlooms: state.extraBlooms,
    ladybug: state.ladybug,
    mood,
    emotion: state.emotion,
    offline: state.offline,
    hasNote: state.hasNote,
  };
}

export const celebrate = () => emit("pet:celebrate");
export const onCelebrate = (cb: () => void) => listen("pet:celebrate", cb);
