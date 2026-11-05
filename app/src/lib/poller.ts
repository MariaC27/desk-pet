// Shared scheduling for background checks (GitHub sync, messages).
import type { UnlistenFn } from "@tauri-apps/api/event";

/** ok = schedule normally; retry = failed, try again sooner (with backoff); idle = nothing to do. */
export type PollResult = "ok" | "retry" | "idle";

const TICK_MS = 60_000;
const RETRY_BASE_MS = 60_000;

/**
 * Runs `run` now, then every `everyMs`. Failures retry after 1, 2, 4… min
 * (capped at `everyMs`). A long gap between ticks means the Mac was asleep,
 * so it runs straight away on wake. `onRequest` subscribes to "do it now"
 * events. Returns a stop function.
 */
export function startPolling(opts: {
  run: () => Promise<PollResult>;
  everyMs: number;
  onRequest?: (cb: () => void) => Promise<UnlistenFn>;
  onTick?: () => void;
}): () => void {
  let nextAt = 0;
  let failures = 0;
  let lastTick = Date.now();
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await opts.run().catch((e) => {
        console.error("poll failed", e);
        return "retry" as const;
      });
      failures = result === "retry" ? failures + 1 : 0;
      const delay =
        result === "retry" ? Math.min(opts.everyMs, RETRY_BASE_MS * 2 ** (failures - 1)) : opts.everyMs;
      nextAt = Date.now() + delay;
    } finally {
      running = false;
    }
  };

  const tick = () => {
    const now = Date.now();
    const woke = now - lastTick > 3 * TICK_MS;
    lastTick = now;
    if (woke || now >= nextAt) run();
    opts.onTick?.();
  };

  run();
  const id = setInterval(tick, Math.min(TICK_MS, opts.everyMs));
  const unlisten = opts.onRequest?.(() => run());
  return () => {
    clearInterval(id);
    unlisten?.then((f) => f());
  };
}
