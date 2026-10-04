import { describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import {
  HeardTrack,
  ICY_AFTER_START_MS,
} from "@/core/player/stream-playback/heard-track";

const track = (raw: string, startMs: number, duration = 200_000): Track =>
  ({
    raw,
    title: raw,
    artist: "A",
    anime: "Anime",
    artwork: `https://example.test/${raw}.jpg`,
    artworks: {},
    duration,
    startTime: new Date(startMs),
  }) as unknown as Track;

const setup = (initial: Track[] = []) => {
  let now = 1_000_000;
  const station = { tracks: initial };
  const heard = new HeardTrack({
    candidates: () => station.tracks,
    stationTrack: () => station.tracks[0] ?? null,
    now: () => now,
  });
  const changes = vi.fn();
  heard.onChange = changes;
  return {
    heard,
    station,
    changes,
    advance: (ms: number) => {
      now += ms;
    },
    get now() {
      return now;
    },
  };
};

describe("HeardTrack", () => {
  it("shows the station's track until a title is heard, without a position", () => {
    const t = setup([track("Song A", 0)]);
    expect(t.heard.track?.raw).toBe("Song A");
    expect(t.heard.anchored).toBe(false);
    expect(t.heard.elapsedMs()).toBeNull();
  });

  it("adopts the API track whose raw title is heard, at the ICY offset", () => {
    const t = setup([track("Song B", 0), track("Song A", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    expect(t.heard.track?.raw).toBe("Song A");
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS);
    t.advance(10_000);
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 10_000);
    expect(t.changes).toHaveBeenCalledTimes(1);
  });

  it("counts from the moment it was heard, not when the event was handled", () => {
    const t = setup([track("Song A", 0)]);
    const heardAt = t.now - 300;
    t.heard.heard("Song A", heardAt, false, 0);
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 300);
  });

  it("waits for the API when the title is heard before it is announced", () => {
    const t = setup([track("Old", 0)]);
    t.heard.heard("New Song", t.now, false, 0);
    expect(t.heard.track?.raw).toBe("Old");
    t.advance(2_000);
    t.station.tracks = [track("New Song", 0), track("Old", 0)];
    t.heard.stationChanged();
    expect(t.heard.track?.raw).toBe("New Song");
    // Heard 2 s ago: the position includes the wait.
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 2_000);
  });

  it("asks for fresh data on an unknown title, then shows the title itself", () => {
    const t = setup([track("Old", 0)]);
    const unknown = vi.fn();
    t.heard.onUnknownTitle = unknown;
    t.heard.heard("DJ Ao Vivo - Hora do Rock | Programa", t.now, false, 0);
    expect(unknown).toHaveBeenCalledWith("DJ Ao Vivo - Hora do Rock | Programa");
    expect(t.heard.track?.raw).toBe("Old"); // nothing shown until the refresh settles
    t.advance(1_000);
    t.heard.unresolved("DJ Ao Vivo - Hora do Rock | Programa");
    expect(t.heard.track).toMatchObject({
      raw: "DJ Ao Vivo - Hora do Rock | Programa",
      artist: "DJ Ao Vivo",
      duration: 0,
    });
    // Named later (API caught up): the real track replaces it, same timeline.
    t.advance(4_000);
    t.station.tracks = [track("DJ Ao Vivo - Hora do Rock | Programa", 0)];
    t.heard.stationChanged();
    expect(t.heard.track?.title).toBe("DJ Ao Vivo - Hora do Rock | Programa");
    expect(t.heard.track?.duration).toBe(200_000);
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 5_000);
  });

  it("ignores a stale unresolved call for a title that was resolved meanwhile", () => {
    const t = setup([track("Old", 0)]);
    t.heard.heard("New", t.now, false, 0);
    t.station.tracks = [track("New", 0)];
    t.heard.stationChanged();
    t.heard.unresolved("New");
    expect(t.heard.track?.duration).toBe(200_000);
  });

  it("places a tune-in partway: station time minus the speaker's lag", () => {
    const t = setup();
    const startedAt = t.now - 60_000; // on air for a minute at the live edge
    t.station.tracks = [track("Live", startedAt)];
    t.heard.heard("Live", t.now, true, 8_000); // the speaker trails by 8 s
    expect(t.heard.elapsedMs()).toBe(52_000);
  });

  it("corrects the tune-in for a wrong device clock once the skew is significant", () => {
    const t = setup();
    t.station.tracks = [track("Live", t.now - 60_000)];
    // Device clock 1 s off: below the threshold, ignored.
    for (let i = 0; i < 9; i++) t.heard.setClockSkew(1_000, 100);
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(60_000);
    // 30 s off (median of the window): applied.
    for (let i = 0; i < 9; i++) t.heard.setClockSkew(30_000, 100);
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(90_000);
    // Imprecise samples (long round trip) are ignored.
    t.heard.setClockSkew(-500_000, 9_000);
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(90_000);
  });

  it("freezes the position while audio does not flow", () => {
    const t = setup([track("Song A", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    t.advance(5_000);
    t.heard.setRunning(false);
    t.advance(60_000);
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 5_000);
    t.heard.setRunning(true);
    t.advance(1_000);
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 6_000);
  });

  it("ignores a repeated title, but re-places it after a re-open", () => {
    const t = setup([track("Song A", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    t.advance(30_000);
    t.heard.heard("Song A", t.now, false, 0); // e.g. a new connection's first block
    expect(t.heard.elapsedMs()).toBe(ICY_AFTER_START_MS + 30_000);
    expect(t.changes).toHaveBeenCalledTimes(1);

    t.heard.reopened();
    expect(t.heard.anchored).toBe(false);
    expect(t.heard.track?.raw).toBe("Song A"); // still displayed while re-opening
    t.station.tracks = [track("Song A", t.now - 40_000)];
    t.heard.heard("Song A", t.now, true, 5_000);
    expect(t.heard.elapsedMs()).toBe(35_000);
  });

  it("matches the previous song from the history (the speaker is behind the station)", () => {
    const t = setup([track("Announced", 0), track("Still playing", 0)]);
    t.heard.heard("Still playing", t.now, false, 0);
    expect(t.heard.track?.raw).toBe("Still playing");
  });

  it("reports no position past the song's end, and clamps tune-ins", () => {
    const t = setup([track("Short", 0, 10_000)]);
    t.heard.heard("Short", t.now, false, 0);
    t.advance(9_000);
    expect(t.heard.elapsedMs()).toBeNull();
    t.station.tracks = [track("Short", t.now - 999_000, 10_000)];
    t.heard.reopened();
    t.heard.heard("Short", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(10_000);
  });

  it("ignores empty titles and resets", () => {
    const t = setup([track("Song A", 0)]);
    t.heard.heard("   ", t.now, false, 0);
    expect(t.heard.anchored).toBe(false);
    t.heard.heard("Song A ", t.now, false, 0); // trimmed
    expect(t.heard.anchored).toBe(true);
    t.heard.reset();
    expect(t.heard.anchored).toBe(false);
    expect(t.heard.elapsedMs()).toBeNull();
  });
});
