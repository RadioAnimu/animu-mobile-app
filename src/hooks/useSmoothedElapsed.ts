import { useEffect, useRef, useState } from "react";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import {
  MAX_PROJECT_MS,
  snapToTarget,
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
    // Timestamps are set at sync time (Date.now is impure at first render).
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
      // react-doctor-disable-next-line no-adjust-state-on-prop-change -- null IS this prop's value.
      setValue(null);
      return;
    }
    // The last authoritative update is from before a long silent stretch —
    // background freeze, app switch, lock screen or a network stall — so the
    // truth moved off-screen. The ease-catch-up is sized for sub-8s calendar
    // gaps; fading a minutes-long correction sweeps the countdown through
    // numbers that were never real. The fact changed off-screen: snap to it.
    // The next update (~1 Hz) restores normal advance+ease smoothing.
    if (s.targetAt > 0 && now - s.targetAt > MAX_PROJECT_MS) {
      const next = snapToTarget(s, targetMs, now);
      s.target = next.target;
      s.targetAt = next.targetAt;
      s.value = next.value;
      s.tickAt = next.tickAt;
      setValue(targetMs);
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
