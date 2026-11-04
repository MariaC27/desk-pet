import { useEffect, useState } from "react";
import {
  EMPTY_STATUS,
  getAccount,
  getCalendar,
  getSyncStatus,
  onDataChanged,
  type Account,
  type CalendarCache,
  type SyncStatus,
} from "../lib/data";
import { DEFAULT_PET_STATE, currentPetState, type PetState } from "../lib/petState";

export interface AppData {
  account: Account | null;
  calendar: CalendarCache | null;
  status: SyncStatus;
  pet: PetState;
}

/** Everything the tracker shows, kept fresh via "data-changed" and a 1-minute tick. */
export function useAppData(): AppData | null {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const [account, calendar, status, pet] = await Promise.all([
        getAccount(),
        getCalendar(),
        getSyncStatus(),
        currentPetState(),
      ]);
      setData({ account, calendar, status: status ?? EMPTY_STATUS, pet: pet ?? DEFAULT_PET_STATE });
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
