import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import { HeardTrack, ICY_AFTER_START_MS } from "@/core/player/stream-playback/heard-track";
import { ICY_MISSING_MS, NowHearing } from "@/core/player/stream-playback/now-hearing";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { jsTimer } from "@/core/player/timer";

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

const setup = () => {
  const station = { track: track("Song A", Date.now() - 60_000) as Track | null };
  const heard = new HeardTrack({
    candidates: () => [station.track],
    stationTrack: () => station.track,
  });
  const sync = new StreamSyncEngine();
  const audible = new AudibleTrackResolver({
    getStationTrack: () => station.track,
    sync,
    timer: jsTimer,
  });
  const pump = vi.fn();
  const hearing = new NowHearing({ heard, sync, audible, pump });
  const changes = vi.fn();
  hearing.onChange = changes;
  heard.onChange = changes;
  /** Seconds of 1 Hz native readings with `lagS` behind the live edge. */
  const play = (seconds: number, lagS = 6) => {
    for (let i = 0; i < seconds; i++) {
      vi.advanceTimersByTime(1_000);
      hearing.progress({ liveOffset: null, bufferedAhead: lagS });
    }
  };
  return { station, heard, sync, audible, hearing, changes, pump, play };
};

describe("NowHearing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T05:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows the ICY titles while the stream carries them", () => {
    const t = setup();
    t.hearing.setPlaying(true);
    t.play(2);
    t.heard.heard("Song A", Date.now(), false, 0);
    t.hearing.titleWasHeard();
    t.play(20);
    expect(t.hearing.mode).toBe("icy");
    expect(t.hearing.anchored).toBe(true);
    expect(t.hearing.elapsedMs()).toBe(ICY_AFTER_START_MS + 20_000);
    expect(t.pump).toHaveBeenCalledTimes(22);
  });

  it("a tune-in takes its position from the settled clock, not the first reading", () => {
    const t = setup(); // Song A: on air for 60 s
    t.hearing.setPlaying(true);
    // The first title plays at once, while the burst is still loading: the
    // lag read then (4.8 s) is far below the real one (17 s).
    t.heard.heard("Song A", Date.now(), true, 4_800);
    t.hearing.titleWasHeard();
    expect(t.hearing.track?.raw).toBe("Song A");
    expect(t.hearing.anchored).toBe(false);
    expect(t.hearing.elapsedMs()).toBeNull();
    t.changes.mockClear();
    t.play(4, 17);
    expect(t.hearing.anchored).toBe(true);
    expect(t.changes).toHaveBeenCalled(); // the lock screen gets the position
    // 64 s on air, 17 s behind.
    expect(t.hearing.elapsedMs()).toBe(47_000);
    // The next change is heard: exact again.
    t.station.track = track("Song B", Date.now());
    t.heard.heard("Song B", Date.now(), false, 17_000);
    expect(t.heard.estimated).toBe(false);
    expect(t.hearing.elapsedMs()).toBe(ICY_AFTER_START_MS);
  });

  it("without titles, the audible clock takes over once it may", () => {
    const t = setup();
    t.hearing.setPlaying(true);
    t.play(ICY_MISSING_MS / 1000 - 1);
    expect(t.hearing.mode).toBe("icy");
    expect(t.hearing.elapsedMs()).toBeNull(); // nothing heard, nothing known
    t.changes.mockClear();
    t.play(1);
    expect(t.hearing.mode).toBe("clock");
    expect(t.changes).toHaveBeenCalled();
    expect(t.hearing.track?.raw).toBe("Song A");
    expect(t.hearing.anchored).toBe(true);
    // 72 s on air, 6 s behind.
    expect(t.hearing.elapsedMs()).toBe(66_000);
  });

  it("in clock mode, the next song shows when the clock reaches it", () => {
    const t = setup();
    t.hearing.setPlaying(true);
    t.play(13);
    t.changes.mockClear();
    // Announced now: on the speaker 6 s from now.
    t.station.track = track("Song B", Date.now());
    t.hearing.stationChanged();
    expect(t.hearing.track?.raw).toBe("Song A");
    t.play(7);
    expect(t.hearing.track?.raw).toBe("Song B");
    expect(t.changes).toHaveBeenCalled();
    expect(t.hearing.elapsedMs()).toBe(1_000);
  });

  it("a re-open measures again: back to ICY until it proves silent", () => {
    const t = setup();
    t.hearing.setPlaying(true);
    t.play(13);
    expect(t.hearing.mode).toBe("clock");
    t.hearing.reopened();
    expect(t.hearing.mode).toBe("icy");
    expect(t.sync.hasMeasurement).toBe(false);
    t.hearing.setPlaying(true);
    t.play(13);
    expect(t.hearing.mode).toBe("clock");
  });

  it("does not count paused time before audio ever played", () => {
    const t = setup();
    t.play(30);
    expect(t.hearing.mode).toBe("icy");
  });

  it("feeds the server clock correction to both sources, and resets", () => {
    const t = setup();
    const heardSkew = vi.spyOn(t.heard, "setClockSkew");
    const syncSkew = vi.spyOn(t.sync, "setClockSkew");
    t.hearing.setClockSkew(30_000, 100);
    expect(heardSkew).toHaveBeenCalledWith(30_000, 100);
    expect(syncSkew).toHaveBeenCalledWith(30_000, 100);
    t.hearing.setPlaying(true);
    t.play(13);
    t.hearing.reset();
    expect(t.hearing.mode).toBe("icy");
    expect(t.audible.track).toBeNull();
  });
});
