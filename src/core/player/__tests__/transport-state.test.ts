import { describe, expect, it, vi } from "vitest";
import {
  TransportStateMachine,
  isPlayingIntentState,
  toRemoteStatus,
} from "../transport-state";

describe("TransportStateMachine", () => {
  it("starts idle", () => {
    const state = new TransportStateMachine();
    expect(state.state).toBe("idle");
    expect(state.isPlayingIntent).toBe(false);
    expect(state.remoteStatus).toBe("stopped");
  });

  it("applies valid transitions and tracks entry time", () => {
    const state = new TransportStateMachine();
    const before = Date.now();

    state.transition("connecting");
    expect(state.state).toBe("connecting");
    expect(state.enteredAt).toBeGreaterThanOrEqual(before);
    expect(state.isPlayingIntent).toBe(true);
    expect(state.remoteStatus).toBe("buffering");
  });

  it("ignores and warns on invalid transitions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = new TransportStateMachine();

    state.transition("paused"); // idle → paused is invalid

    expect(state.state).toBe("idle");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("follows the play → pause → play → reconnecting → playing path", () => {
    const state = new TransportStateMachine();

    state.transition("connecting");
    state.transition("paused");
    state.transition("connecting");
    state.transition("reconnecting");
    state.transition("playing");

    expect(state.state).toBe("playing");
    expect(state.isPlayingIntent).toBe(true);
    expect(state.remoteStatus).toBe("playing");
  });

  it("maps every state to the right remote status", () => {
    expect(toRemoteStatus("idle")).toBe("stopped");
    expect(toRemoteStatus("connecting")).toBe("buffering");
    expect(toRemoteStatus("reconnecting")).toBe("buffering");
    expect(toRemoteStatus("playing")).toBe("playing");
    expect(toRemoteStatus("paused")).toBe("paused");
    expect(isPlayingIntentState("connecting")).toBe(true);
    expect(isPlayingIntentState("paused")).toBe(false);
  });
});
