import { useEffect, useRef } from "react";
import type { BlurredCoverProps } from "@/screens/Lyrics/BlurredCover";

/** Pixels across the blur. */
const SIZE = 32;
/**
 * Pixels across the canvas shown: the blur scaled up and smoothed again, so
 * the GPU's own (bilinear) stretch to the layer leaves no visible grid.
 */
const SHOWN = 128;
/** Standard deviation of the smoothing after the scale-up, in shown pixels. */
const SMOOTHING = 2;
/** Layer pixels one blur pixel covers before the layer is laid out (a desktop window). */
const FALLBACK_PX_PER_PIXEL = 40;
/** Past this standard deviation (blur pixels) the cover is one colour anyway. */
const MAX_SIGMA = SIZE / 4;

/**
 * Web build: the cover blurred once into a small canvas the layer stretches.
 * A CSS `blur()` on an image scaled past the window is redrawn whenever its
 * layer turns, every frame: a few frames a second in Safari, or in Chrome
 * without GPU rasterization. The canvas may be tainted by a cover without
 * CORS: it is only shown, never read back.
 */
export function BlurredCover({ cover, blurRadius, transition }: Readonly<BlurredCoverProps>) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // What the canvas shows now, to cross-fade from.
  const shown = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    let frame = 0;
    const image = new window.Image();
    image.onload = () => {
      // A CSS `blur()` is a standard deviation in layer pixels; the square
      // canvas covers the layer's longer side.
      const span = Math.max(canvas.clientWidth, canvas.clientHeight);
      const next = blurred(image, blurRadius / (span > 0 ? span / SIZE : FALLBACK_PX_PER_PIXEL));
      if (!next) return;
      const previous = shown.current;
      shown.current = next;
      if (!previous || transition <= 0) {
        draw(context, next, 1, null);
        return;
      }
      const started = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - started) / transition);
        draw(context, next, t, previous);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      step();
    };
    image.src = cover;
    return () => {
      image.onload = null;
      cancelAnimationFrame(frame);
    };
  }, [cover, blurRadius, transition]);

  return (
    <canvas
      ref={ref}
      width={SHOWN}
      height={SHOWN}
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function draw(
  context: CanvasRenderingContext2D,
  next: HTMLCanvasElement,
  alpha: number,
  previous: HTMLCanvasElement | null,
): void {
  context.globalAlpha = 1;
  context.clearRect(0, 0, SHOWN, SHOWN);
  if (previous) context.drawImage(previous, 0, 0);
  context.globalAlpha = alpha;
  context.drawImage(next, 0, 0);
  context.globalAlpha = 1;
}

function canvasOf(size: number): Surface | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

/**
 * The cover's centre square at {@link SIZE} px, halved in steps (one big
 * downscale aliases in Safari), blurred by `sigma` (its pixels), then scaled up
 * to {@link SHOWN} px and smoothed.
 */
function blurred(image: HTMLImageElement, sigma: number): HTMLCanvasElement | null {
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!(side > 0)) return null;
  let size = side;
  while (size / 2 > SIZE) size = Math.round(size / 2);
  let current = canvasOf(size);
  if (!current) return null;
  current.context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  while (size > SIZE) {
    size = Math.max(SIZE, Math.round(size / 2));
    const smaller = canvasOf(size);
    if (!smaller) return null;
    smaller.context.drawImage(current.canvas, 0, 0, size, size);
    current = smaller;
  }
  blur(current, Math.min(sigma, MAX_SIGMA));
  const shown = canvasOf(SHOWN);
  if (!shown) return null;
  shown.context.drawImage(current.canvas, 0, 0, SHOWN, SHOWN);
  blur(shown, SMOOTHING);
  return shown.canvas;
}

interface Surface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

/** A Gaussian of about `sigma` px: n passes of a 3-tap box have a variance of 2n/3 px² per axis. */
function blur(surface: Surface, sigma: number): void {
  const copy = canvasOf(surface.canvas.width);
  if (!copy) return;
  const passes = Math.max(1, Math.round((sigma * sigma * 3) / 2));
  for (let pass = 0; pass < passes; pass++) {
    boxPass(surface.context, copy, 1, 0);
    boxPass(surface.context, copy, 0, 1);
  }
}

/** Averages each pixel with its two neighbours along (dx, dy), by drawing shifted copies. */
function boxPass(
  context: CanvasRenderingContext2D,
  copy: Surface,
  dx: number,
  dy: number,
): void {
  const size = copy.canvas.width;
  copy.context.clearRect(0, 0, size, size);
  copy.context.drawImage(context.canvas, 0, 0);
  context.globalAlpha = 1 / 2;
  context.drawImage(copy.canvas, -dx, -dy);
  context.globalAlpha = 1 / 3;
  context.drawImage(copy.canvas, dx, dy);
  context.globalAlpha = 1;
}
