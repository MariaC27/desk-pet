import { useEffect, useRef } from "react";
import { H, W, composePet, type PetView } from "./sprite";

/** Static render of the plant, e.g. for the tracker. */
export function PetPreview({ view, scale = 3 }: { view: PetView; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    composePet(view, { t: 0, blink: false }).forEach((color, i) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(i % W, Math.floor(i / W), 1, 1);
    });
  }, [view.count, view.mood, view.offline, view.hasMessage]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className="pixelated"
      style={{ width: W * scale, height: H * scale }}
    />
  );
}
