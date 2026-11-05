// What the pet renders from, derived from the cached GitHub calendar. In dev
// builds the dev panel can override it to preview any state.
import { emit, listen } from "@tauri-apps/api/event";
import {
  getCalendar,
  getDevOverride,
  getMessages,
  getSyncStatus,
  type CalendarCache,
  type SyncStatus,
} from "./data";
import { localDateKey, weekCount } from "./growth";

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

export function derivePetState(
  cal: CalendarCache | null,
  status: SyncStatus,
  now = new Date(),
  unreadMessages = 0,
): PetState {
  const offline = status.error === "offline";
  const hasMessage = unreadMessages > 0;
  if (!cal) return { ...DEFAULT_PET_STATE, offline, hasMessage };

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const recentDays = [localDateKey(now), localDateKey(yesterday)];
  const recent = cal.days.filter((d) => recentDays.includes(d.date)).reduce((n, d) => n + d.count, 0);

  return {
    count: weekCount(cal.days, now),
    baseMood: recent > 0 ? "idle" : "resting",
    offline,
    hasMessage,
  };
}

export async function currentPetState(now = new Date()): Promise<PetState> {
  const override = import.meta.env.DEV ? await getDevOverride<PetState>() : null;
  if (override) return override;
  const unread = (await getMessages()).filter((m) => !m.readAt).length;
  return derivePetState(await getCalendar(), await getSyncStatus(), now, unread);
}

export const celebrate = () => emit("pet:celebrate");
export const onCelebrate = (cb: () => void) => listen("pet:celebrate", cb);
