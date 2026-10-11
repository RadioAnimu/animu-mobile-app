import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import { HeardTrack, ICY_AFTER_START_MS } from "@/core/player/stream-playback/heard-track";
import {
  ICY_MISSING_MS,
  ICY_OVERDUE_MS,
  NowHearing,
} from "@/core/player/stream-playback/now-hearing";
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

  describe("once synced, the position only moves in real time", () => {
    const jitter = [14.2, 17.9, 12.5, 16.1, 15.4, 13.3, 17.0, 11.8];

    it("a tune-in ignores later lag jitter", () => {
      const t = setup(); // Song A: on air for 60 s
      t.hearing.setPlaying(true);
      t.heard.heard("Song A", Date.now(), true, 4_800);
      t.hearing.titleWasHeard();
      t.play(4, 17);
      const position = t.hearing.position();
      expect(t.hearing.elapsedMs()).toBe(47_000);
      t.changes.mockClear();
      for (const lag of jitter) t.play(1, lag);
      expect(t.hearing.position()).toEqual(position);
      expect(t.hearing.elapsedMs()).toBe(47_000 + jitter.length * 1_000);
      expect(t.changes).not.toHaveBeenCalled(); // nothing to re-push to the lock screen
    });

    it("without titles, the clock ignores later lag jitter", () => {
      const t = setup();
      t.hearing.setPlaying(true);
      t.play(13, 6);
      expect(t.hearing.elapsedMs()).toBe(67_000);
      const position = t.hearing.position();
      for (const lag of jitter.map((l) => l - 10)) t.play(1, lag);
      expect(t.hearing.position()).toEqual(position);
      expect(t.hearing.elapsedMs()).toBe(67_000 + jitter.length * 1_000);
    });

    it("holds through a pause and resumes where the audio was", () => {
      const t = setup();
      t.hearing.setPlaying(true);
      t.play(13, 6);
      t.hearing.setPlaying(false);
      vi.advanceTimersByTime(30_000);
      expect(t.hearing.position()?.running).toBe(false);
      expect(t.hearing.elapsedMs()).toBe(67_000);
      t.hearing.setPlaying(true);
      t.play(2, 36); // the buffer now trails by the 30 s paused as well
      expect(t.hearing.elapsedMs()).toBe(69_000);
    });

    it("a re-lock (the lock was early) reaches the lock screen", () => {
      const t = setup();
      t.hearing.setPlaying(true);
      t.play(13, 6);
      t.changes.mockClear();
      t.play(5, 9); // the connect burst finished loading: 3 s more behind
      expect(t.changes).toHaveBeenCalledTimes(1);
      expect(t.hearing.elapsedMs()).toBe(67_000 + 5_000 - 3_000);
    });
  });

  describe("a station item whose ICY title never arrives", () => {
    const JINGLE = "Rádio Animu - Vinheta";
    /** A 10 s jingle heard at its change (6 s behind), then Song B announced as it ends. */
    const jingleThenSongB = () => {
      const t = setup();
      t.station.track = track(JINGLE, Date.now(), 10_000);
      t.hearing.setPlaying(true);
      t.play(6);
      t.heard.heard(JINGLE, Date.now(), false, 4_800);
      t.hearing.titleWasHeard();
      t.play(4);
      t.station.track = track("Song B", Date.now());
      t.hearing.stationChanged();
      return t;
    };

    it("shows the station's item once its title is overdue", () => {
      const t = jingleThenSongB();
      // Song B reaches the speaker 6 s after it was announced; its title
      // never comes. Short of the overdue window, the jingle stays.
      t.play(6 + ICY_OVERDUE_MS / 1000 - 3);
      expect(t.hearing.track?.raw).toBe(JINGLE);
      t.changes.mockClear();
      t.play(4);
      expect(t.hearing.track?.raw).toBe("Song B");
      expect(t.hearing.mode).toBe("icy");
      expect(t.hearing.anchored).toBe(true);
      expect(t.changes).toHaveBeenCalledTimes(1);
      // Placed on the audible clock: ~31 s into Song B.
      expect(t.hearing.elapsedMs()).toBeGreaterThanOrEqual(ICY_OVERDUE_MS);
      expect(t.hearing.elapsedMs()).toBeLessThanOrEqual(ICY_OVERDUE_MS + 2_000);
    });

    it("hands back to ICY at the next title", () => {
      const t = jingleThenSongB();
      t.play(6 + ICY_OVERDUE_MS / 1000 + 1);
      expect(t.hearing.track?.raw).toBe("Song B");
      t.station.track = track("Song C", Date.now());
      t.heard.heard("Song C", Date.now(), false, 6_000);
      t.hearing.titleWasHeard();
      expect(t.hearing.track?.raw).toBe("Song C");
      expect(t.hearing.elapsedMs()).toBe(ICY_AFTER_START_MS);
    });

    it("follows a newer station item while still overdue", () => {
      const t = jingleThenSongB();
      t.play(6 + ICY_OVERDUE_MS / 1000 + 1);
      t.changes.mockClear();
      // Song B was short; Song C is announced and also never titled.
      t.station.track = track("Song C", Date.now());
      t.hearing.stationChanged();
      expect(t.hearing.track?.raw).toBe(JINGLE); // C not audible long enough yet
      t.play(6 + ICY_OVERDUE_MS / 1000 + 1);
      expect(t.hearing.track?.raw).toBe("Song C");
      expect(t.changes).toHaveBeenCalled();
    });

    it("keeps a heard title the station has not named yet", () => {
      const t = jingleThenSongB();
      t.play(3);
      // ICY names something else: the speaker is not on Song B.
      t.heard.heard("Live Show", Date.now(), false, 6_000);
      t.play(6 + ICY_OVERDUE_MS / 1000 + 5);
      expect(t.hearing.track?.raw).toBe(JINGLE);
      t.heard.unresolved("Live Show");
      expect(t.hearing.track?.raw).toBe("Live Show");
    });

    it("never takes over before the clock settles", () => {
      const t = setup();
      t.station.track = track(JINGLE, Date.now() - 60_000, 10_000);
      t.hearing.setPlaying(true);
      t.heard.heard(JINGLE, Date.now() - 50_000, false, 0);
      t.hearing.titleWasHeard();
      t.station.track = track("Song B", Date.now() - 45_000);
      t.hearing.stationChanged();
      expect(t.sync.settled).toBe(false);
      expect(t.hearing.track?.raw).toBe(JINGLE);
    });

    it("leaves a heard track that has not ended alone", () => {
      const t = setup(); // Song A: 200 s long
      t.hearing.setPlaying(true);
      t.play(2);
      t.heard.heard("Song A", Date.now(), false, 0);
      t.hearing.titleWasHeard();
      // The station already moved on (its data ahead of the audio).
      t.station.track = track("Song B", Date.now() - 60_000);
      t.hearing.stationChanged();
      t.play(40);
      expect(t.hearing.track?.raw).toBe("Song A");
    });
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
