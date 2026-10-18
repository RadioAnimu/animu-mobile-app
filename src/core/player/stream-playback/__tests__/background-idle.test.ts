import { describe, expect, it } from "vitest";
import {
  BACKGROUND_IDLE_CUTOFF_MS,
  BackgroundIdle,
} from "@/core/player/stream-playback/background-idle";

const MINUTE = 60_000;

const make = () => {
  let now = 1_000_000;
  const idle = new BackgroundIdle(() => now);
  return {
    idle,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

describe("BackgroundIdle", () => {
  it("is allowed with the app visible, however long nothing plays", () => {
    const t = make();
    t.idle.update(true, false);
    t.advance(60 * MINUTE);
    expect(t.idle.idle).toBe(false);
    expect(t.idle.liveAllowed()).toBe(true);
  });

  it("is allowed while audio is wanted in the background, indefinitely", () => {
    const t = make();
    t.idle.update(false, true);
    t.advance(6 * 60 * MINUTE);
    expect(t.idle.idle).toBe(false);
    expect(t.idle.liveAllowed()).toBe(true);
  });

  it("expires once hidden and silent for the whole cutoff (hide, then pause)", () => {
    const t = make();
    t.idle.update(false, true); // hidden while playing
    t.advance(30 * MINUTE);
    t.idle.update(false, false); // pause: the clock starts here
    t.advance(BACKGROUND_IDLE_CUTOFF_MS - 1);
    expect(t.idle.idle).toBe(true);
    expect(t.idle.liveAllowed()).toBe(true);
    t.advance(1);
    expect(t.idle.liveAllowed()).toBe(false);
  });

  it("expires once hidden and silent for the whole cutoff (pause, then hide)", () => {
    const t = make();
    t.idle.update(true, true);
    t.idle.update(true, false); // paused in the foreground: not idle yet
    t.advance(20 * MINUTE);
    expect(t.idle.liveAllowed()).toBe(true);
    t.idle.update(false, false); // hidden now: a fresh ten minutes
    t.advance(BACKGROUND_IDLE_CUTOFF_MS - 1);
    expect(t.idle.liveAllowed()).toBe(true);
    t.advance(1);
    expect(t.idle.liveAllowed()).toBe(false);
  });

  it("keeps its anchor across repeated updates while idle", () => {
    const t = make();
    t.idle.update(false, false);
    t.advance(6 * MINUTE);
    t.idle.update(false, false);
    t.advance(4 * MINUTE);
    t.idle.update(false, false);
    expect(t.idle.idleForMs()).toBe(10 * MINUTE);
    expect(t.idle.liveAllowed()).toBe(false);
  });

  it("starts over when the app comes back to the foreground", () => {
    const t = make();
    t.idle.update(false, false);
    t.advance(9 * MINUTE);
    t.idle.update(true, false);
    expect(t.idle.idleForMs()).toBe(0);
    t.idle.update(false, false);
    t.advance(9 * MINUTE);
    expect(t.idle.liveAllowed()).toBe(true);
  });

  it("starts over, and re-allows, on a play intent (even past the deadline)", () => {
    const t = make();
    t.idle.update(false, false);
    t.advance(BACKGROUND_IDLE_CUTOFF_MS + MINUTE);
    expect(t.idle.liveAllowed()).toBe(false);
    t.idle.update(false, true); // lock-screen play
    expect(t.idle.liveAllowed()).toBe(true);
    t.idle.update(false, false); // paused again: a fresh ten minutes
    t.advance(BACKGROUND_IDLE_CUTOFF_MS - 1);
    expect(t.idle.liveAllowed()).toBe(true);
  });

  it("the intent covers buffering and reconnecting (the caller passes it as intent)", () => {
    // Buffering/reconnecting keep `playWhenReady`: the intent stays true, so
    // a hidden app that is reconnecting never starts the clock.
    const t = make();
    t.idle.update(false, true);
    t.advance(30 * MINUTE);
    t.idle.update(false, true);
    expect(t.idle.idle).toBe(false);
    expect(t.idle.liveAllowed()).toBe(true);
  });
});
