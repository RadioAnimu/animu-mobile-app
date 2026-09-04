import { describe, expect, it, vi } from "vitest";
import {
  playerStore,
  progressStore,
  stationStore,
} from "../store";

describe("player stores", () => {
  it("notify only when the snapshot actually changed", () => {
    const spy = vi.fn();
    const unsubscribe = playerStore.subscribe(spy);

    playerStore.setSnapshot({ isPlaying: true, isInitialized: true });
    expect(spy).toHaveBeenCalledTimes(1);

    playerStore.setSnapshot({ isPlaying: true, isInitialized: true });
    expect(spy).toHaveBeenCalledTimes(1); // identical → no notification

    playerStore.setSnapshot({ isPlaying: false, isInitialized: true });
    expect(spy).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("diff per key with shallow equality", () => {
    const spy = vi.fn();
    const unsubscribe = stationStore.subscribe(spy);
    const tracks = [{ raw: "a" }] as unknown as never[];

    stationStore.setSnapshot({ lastPlayedTracks: tracks });
    expect(spy).toHaveBeenCalledTimes(1);

    stationStore.setSnapshot({ lastPlayedTracks: tracks });
    expect(spy).toHaveBeenCalledTimes(1); // same reference → no notification

    stationStore.setSnapshot({ lastPlayedTracks: [...tracks] });
    expect(spy).toHaveBeenCalledTimes(2); // new reference → notification

    unsubscribe();
  });

  it("keep the three cadences independent", () => {
    const playerSpy = vi.fn();
    const stationSpy = vi.fn();
    const progressSpy = vi.fn();
    const u1 = playerStore.subscribe(playerSpy);
    const u2 = stationStore.subscribe(stationSpy);
    const u3 = progressStore.subscribe(progressSpy);

    // A 1 Hz progress tick must not touch the other stores
    progressStore.setSnapshot({ currentTrackProgress: 1000, showProgress: true });
    expect(progressSpy).toHaveBeenCalledTimes(1);
    expect(playerSpy).not.toHaveBeenCalled();
    expect(stationSpy).not.toHaveBeenCalled();

    // A listener-count poll must not touch the other stores
    stationStore.setSnapshot({ currentListeners: { value: 5 } });
    expect(stationSpy).toHaveBeenCalledTimes(1);
    expect(playerSpy).not.toHaveBeenCalled();
    expect(progressSpy).toHaveBeenCalledTimes(1);

    u1();
    u2();
    u3();
  });
});
