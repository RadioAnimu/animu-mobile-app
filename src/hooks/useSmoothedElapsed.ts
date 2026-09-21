import { useEffect, useRef, useState } from "react";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import {
  stepSmoothed,
  type SmoothedState,
} from "@/hooks/smoothed-elapsed";

/** How often the smoothed value is recomputed (ms). */
const TICK_MS = 250;

/**
 * Smooths a ~1 Hz authoritative elapsed value into a continuously advancing
 * one.
 *
 * The sync engine's lag estimate moves as the buffer fills/drains, so the raw
 * elapsed value arrives in uneven steps — the countdown stalls then jumps.
 * This advances the last value at real time between updates and eases toward
 * the authoritative value, re-anchoring instantly when the track changes
 * (`resetKey`). Backgrounded, the timer stops and the value simply holds; a
 * foreground re-anchor corrects it.
 */
export function useSmoothedElapsed(
  targetMs: number | null,
  resetKey: string | null | undefined,
): number | null {
  const isBackgrounded = useIsBackgrounded();
  const [value, setValue] = useState<number | null>(targetMs);
  const state = useRef<
    SmoothedState & { key: string | null | undefined; active: boolean }
  >({
    key: resetKey,
    value: targetMs ?? 0,
    target: targetMs ?? 0,
    // Timestamps are set in the effects below (Date.now is impure at render).
    targetAt: 0,
    tickAt: 0,
    active: targetMs != null,
  });

  // Re-anchor on every authoritative update; reset on a track change.
  useEffect(() => {
    const s = state.current;
    const now = Date.now();
    if (s.key !== resetKey) {
      s.key = resetKey;
      s.value = targetMs ?? 0;
      s.target = targetMs ?? 0;
      s.targetAt = now;
      s.tickAt = now;
      s.active = targetMs != null;
      setValue(targetMs);
      return;
    }
    s.active = targetMs != null;
    if (targetMs == null) {
      setValue(null);
      return;
    }
    s.target = targetMs;
    s.targetAt = now;
  }, [targetMs, resetKey]);

  // Advance + ease on a steady cadence while the UI is visible.
  useEffect(() => {
    if (isBackgrounded) return;
    state.current.tickAt = Date.now();
    const id = setInterval(() => {
      const s = state.current;
      if (!s.active) return;
      const next = stepSmoothed(s, Date.now());
      s.value = next.value;
      s.tickAt = next.tickAt;
      setValue(next.value);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isBackgrounded, resetKey]);

  return value;
}
