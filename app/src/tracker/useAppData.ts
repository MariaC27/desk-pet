import { useEffect, useState } from "react";
import {
  EMPTY_STATUS,
  getAccount,
  getCalendar,
  getMessages,
  getNotifyMessages,
  getPairing,
  getSyncStatus,
  getUpdate,
  onDataChanged,
  type Account,
  type CalendarCache,
  type Message,
  type Pairing,
  type SyncStatus,
  type UpdateInfo,
} from "../lib/data";
import { DEFAULT_PET_STATE, currentPetState, type PetState } from "../lib/petState";
import { availableUpdate } from "../lib/updates";

export interface AppData {
  account: Account | null;
  calendar: CalendarCache | null;
  status: SyncStatus;
  pet: PetState;
  pairing: Pairing | null;
  /** Newest first. */
  messages: Message[];
  notifyMessages: boolean;
  /** A newer version ready to install, if any. */
  update: UpdateInfo | null;
}

/** Everything the tracker shows, kept fresh via "data-changed" and a 1-minute tick. */
export function useAppData(): AppData | null {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const [account, calendar, status, pet, pairing, messages, notifyMessages, update] = await Promise.all([
        getAccount(),
        getCalendar(),
        getSyncStatus(),
        currentPetState(),
        getPairing(),
        getMessages(),
        getNotifyMessages(),
        getUpdate().then(availableUpdate),
      ]);
      setData({
        account,
        calendar,
        status: status ?? EMPTY_STATUS,
        pet: pet ?? DEFAULT_PET_STATE,
        pairing,
        messages: [...messages].reverse(),
        notifyMessages,
        update,
      });
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    const unlisten = onDataChanged(refresh);
    return () => {
      clearInterval(id);
      unlisten.then((f) => f());
    };
  }, []);

  return data;
}
