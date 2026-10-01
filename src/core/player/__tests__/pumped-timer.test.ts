import { describe, expect, it, vi } from "vitest";

import { createFakeTimer } from "@/core/player/__tests__/fake-timer";
import { createPumpedTimer } from "@/core/player/timer";

/** A base timer that never fires on its own — Android's backgrounded JS. */
const frozenBase = () => createFakeTimer();

describe("createPumpedTimer", () => {
  it("fires a due callback from pump() while the base timer is frozen", () => {
    let now = 0;
    const timer = createPumpedTimer(frozenBase(), () => now);
    const fn = vi.fn();
    timer.set(fn, 2_000);

    now = 1_999;
    timer.pump();
    expect(fn).not.toHaveBeenCalled();

    now = 2_000;
    timer.pump();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs each callback once, whichever path reaches it first", () => {
    let now = 0;
    const base = createFakeTimer();
    const timer = createPumpedTimer(base, () => now);
    const fn = vi.fn();
    timer.set(fn, 1_000);

    now = 1_000;
    timer.pump();
    base.advance(1_000); // the JS timer would have fired too
    timer.pump();
    expect(fn).toHaveBeenCalledTimes(1);

    const viaBase = vi.fn();
    timer.set(viaBase, 500);
    base.advance(500);
    now = 5_000;
    timer.pump();
    expect(viaBase).toHaveBeenCalledTimes(1);
  });

  it("fires overdue callbacks earliest-deadline first", () => {
    let now = 0;
    const timer = createPumpedTimer(frozenBase(), () => now);
    const order: string[] = [];
    timer.set(() => order.push("late"), 3_000);
    timer.set(() => order.push("early"), 1_000);

    now = 10_000;
    timer.pump();
    expect(order).toEqual(["early", "late"]);
  });

  it("never fires a cleared callback", () => {
    let now = 0;
    const timer = createPumpedTimer(frozenBase(), () => now);
    const fn = vi.fn();
    const id = timer.set(fn, 1_000);
    timer.clear(id);

    now = 5_000;
    timer.pump();
    expect(fn).not.toHaveBeenCalled();
  });

  it("lets a fired callback schedule its successor without firing it early", () => {
    let now = 0;
    const timer = createPumpedTimer(frozenBase(), () => now);
    const fn = vi.fn(() => {
      timer.set(fn, 1_000);
    });
    timer.set(fn, 1_000);

    now = 1_000;
    timer.pump();
    expect(fn).toHaveBeenCalledTimes(1);

    now = 1_999;
    timer.pump();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
