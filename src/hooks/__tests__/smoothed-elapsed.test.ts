import { describe, expect, it } from "vitest";
import {
  snapToTarget,
  stepSmoothed,
  type SmoothedState,
} from "@/hooks/smoothed-elapsed";

const base = (over: Partial<SmoothedState> = {}): SmoothedState => ({
  target: 0,
  targetAt: 0,
  value: 0,
  tickAt: 0,
  ...over,
});

describe("stepSmoothed", () => {
  it("advances at real time when aligned with the target", () => {
    // Target and value both 5000, last tick 250ms ago.
    const next = stepSmoothed(
      base({ target: 5000, value: 5000, targetAt: 750, tickAt: 750 }),
      1000,
    );
    // projected = 5000 + 250; advanced = 5250; gap 0 → exactly the projection.
    expect(next.value).toBeCloseTo(5250, 5);
  });

  it("eases toward a target that jumped ahead instead of snapping", () => {
    // The authoritative value is 5s ahead of the displayed one.
    const next = stepSmoothed(
      base({ target: 10_000, value: 5_000, targetAt: 750, tickAt: 750 }),
      1000,
    );
    expect(next.value).toBeGreaterThan(5_000);
    expect(next.value).toBeLessThan(7_000); // a fraction, not the whole gap
  });

  it("clamps a long gap so a background → foreground jump cannot fling it", () => {
    const next = stepSmoothed(
      base({ target: 0, value: 0, targetAt: 0, tickAt: 0 }),
      60_000,
    );
    // One step is bounded by MAX_STEP_MS of real time.
    expect(next.value).toBeLessThan(2_000);
  });
});

describe("snapToTarget", () => {
  it("re-anchors value and timestamps to the fresh fact in one step", () => {
    // Minutes elapsed off-screen (background/lock): the displayed value is
    // stale and the next authoritative update is minutes ahead. Easing would
    // sweep the countdown through numbers that were never real — the
    // re-anchor snaps value to target and zeroes both clocks at `now`.
    const next = snapToTarget(
      base({ target: 5_000, targetAt: 750, value: 5_000, tickAt: 750 }),
      300_000,
      310_000,
    );
    expect(next.value).toBe(300_000);
    expect(next.target).toBe(300_000);
    expect(next.targetAt).toBe(310_000);
    expect(next.tickAt).toBe(310_000);
  });
});
