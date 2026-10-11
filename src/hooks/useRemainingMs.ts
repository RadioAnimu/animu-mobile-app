import { useEffect, useState } from "react";
import {
  elapsedAt,
  msUntilNextSecond,
  type ProgressAnchor,
} from "@/utils/progress";

const remainingAt = (
  anchor: ProgressAnchor,
  durationMs: number,
  now: number,
): number => Math.max(0, durationMs - (elapsedAt(anchor, durationMs, now) ?? 0));

/**
 * Time left in the heard track (ms), for a whole-second countdown.
 *
 * The progress anchor already advances in real time, so nothing is smoothed
 * or polled: the hook re-renders exactly when the displayed second changes
 * (a timer aimed at each boundary), so every second on screen lasts one
 * second. Idle while `active` is false (app hidden) or the audio is stopped;
 * a new anchor re-aims it.
 */
export function useRemainingMs(
  anchor: ProgressAnchor,
  durationMs: number,
  active: boolean,
): number {
  const { progressMs, progressAt, progressRunning } = anchor;
  // Spawns at the live value (screen switch, thaw), not the anchor's.
  const [remaining, setRemaining] = useState(() =>
    remainingAt(anchor, durationMs, Date.now()),
  );

  useEffect(() => {
    const current = { progressMs, progressAt, progressRunning };
    let id: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const left = remainingAt(current, durationMs, Date.now());
      setRemaining(left);
      if (active && progressRunning && progressMs != null && left > 0) {
        id = setTimeout(update, msUntilNextSecond(left));
      }
    };
    update();
    return () => clearTimeout(id);
  }, [progressMs, progressAt, progressRunning, durationMs, active]);

  return remaining;
}
