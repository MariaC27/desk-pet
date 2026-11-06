import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { MAX_STAGE } from "../lib/growth";
import { onDataChanged } from "../lib/data";
import { DEFAULT_PET_STATE, currentPetState, onCelebrate, petView, type PetState } from "../lib/petState";
import { openTracker, setHitMask, showPetMenu } from "../lib/settings";
import { startMessageLoop } from "../lib/messages";
import { startSyncLoop } from "../lib/sync";
import { H, W, composePet, hitMask, type Mood } from "./sprite";

const TICK_MS = 100;
const HAPPY_MS = 90_000; // after a new contribution
const FRESH_WEEK_MS = 8_000; // cheerful seed right after the weekly reset
const STAGE_UP_MS = 2_500;
const FULL_BLOOM_MS = 4_500;
const DRAG_THRESHOLD = 3;
/** Re-derive state this often so the weekly reset and "resting" happen on time, offline too. */
const REFRESH_MS = 60_000;

export function PetWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<PetState>(DEFAULT_PET_STATE);
  const flash = useRef<{ mood: Mood; until: number } | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  /** When the current emotion arrived (its intro animation plays from here). */
  const emotionSince = useRef(0);

  const setFlash = (mood: Mood, ms: number) => {
    flash.current = { mood, until: Date.now() + ms };
  };

  const currentMood = (): Mood => {
    const f = flash.current;
    if (f && f.until > Date.now()) return f.mood;
    return state.current.baseMood;
  };

  // state updates: react to growth with a short flourish
  useEffect(() => {
    const apply = (next: PetState) => {
      const prev = state.current;
      if (next.emotionKey && next.emotionKey !== prev.emotionKey) emotionSince.current = Date.now();
      // compare stages, not counts: the scale can change when a new week starts
      if (next.stage > prev.stage && next.count > prev.count) {
        setFlash("celebrating", next.stage === MAX_STAGE ? FULL_BLOOM_MS : STAGE_UP_MS);
      } else if (next.count > prev.count) {
        setFlash("happy", HAPPY_MS);
      } else if (next.count === 0 && prev.count > 0) {
        setFlash("happy", FRESH_WEEK_MS);
      }
      state.current = next;
    };

    const refresh = () => currentPetState().then(apply);
    // First load is silent (no celebration for growth that happened while
    // closed), but an emotion that arrived meanwhile still plays its intro.
    currentPetState().then((s) => {
      state.current = s;
      if (s.emotion) emotionSince.current = Date.now();
    });
    const id = setInterval(refresh, REFRESH_MS);
    const unlisten = [onDataChanged(refresh), onCelebrate(() => setFlash("celebrating", FULL_BLOOM_MS))];
    return () => {
      clearInterval(id);
      unlisten.forEach((p) => p.then((f) => f()));
    };
  }, []);

  useEffect(() => startSyncLoop(), []);
  useEffect(() => startMessageLoop(), []);

  // render loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let nextBlink = Date.now() + 3000;
    let blinkUntil = 0;
    let last = "";
    let lastMask = "";

    const id = setInterval(() => {
      const now = Date.now();
      if (now >= nextBlink) {
        blinkUntil = now + 140;
        nextBlink = now + 2500 + Math.random() * 4000;
      }
      const s = state.current;
      const mask = hitMask(petView(s, "idle"));
      if (mask !== lastMask) {
        lastMask = mask;
        setHitMask(mask);
      }
      const pixels = composePet(petView(s, currentMood()), {
        t: now,
        blink: now < blinkUntil,
        emotionAge: now - emotionSince.current,
      });
      const key = pixels.join();
      if (key === last) return;
      last = key;
      ctx.clearRect(0, 0, W, H);
      pixels.forEach((color, i) => {
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(i % W, Math.floor(i / W), 1, 1);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const hasUnread = () => state.current.hasNote || !!state.current.emotion;

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) press.current = { x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const p = press.current;
    if (!p || !(e.buttons & 1)) return;
    if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > DRAG_THRESHOLD) {
      press.current = null;
      getCurrentWindow().startDragging();
    }
  };

  // Click: skip a celebration, otherwise open any unread note/emotion (which
  // marks it read, so the envelope and the emotion clear).
  const onMouseUp = () => {
    if (!press.current) return;
    press.current = null;
    if (currentMood() === "celebrating") flash.current = null;
    else if (hasUnread()) openTracker("messages");
  };

  return (
    <canvas
      ref={canvasRef}
      className="pet-canvas"
      width={W}
      height={H}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={() => !hasUnread() && openTracker("activity")}
      onContextMenu={(e) => {
        e.preventDefault();
        showPetMenu();
      }}
    />
  );
}
