// Which tab/step a window should show. Rust passes it to a new window as
// `window.__ROUTE__` and to an already-open one as a "route" event.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    __ROUTE__?: string;
  }
}

export function useRoute<T extends string>(fallback: T): [T, (r: T) => void] {
  const [route, setRoute] = useState<T>((window.__ROUTE__ as T) ?? fallback);
  useEffect(() => {
    const unlisten = getCurrentWindow().listen<T>("route", (e) => setRoute(e.payload));
    return () => {
      unlisten.then((f) => f());
    };
  }, []);
  return [route, setRoute];
}
