import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import {
  HeardTrack,
  STATION_AHEAD_OF_AUDIO_MS,
  icyTitleInItemMs,
} from "@/core/player/stream-playback/heard-track";
import {
  ICY_MISSING_MS,
  ICY_OVERDUE_MS,
  NowHearing,
  STATION_AFTER_PAUSE_MS,
} from "@/core/player/stream-playback/now-hearing";
import { StreamSyncEngine } from "@/core/player/stream-playback/stream-sync";
import { jsTimer } from "@/core/player/timer";

/** Where a title is heard in its item on the default (320 kbps) mount. */
const AT_TITLE = icyTitleInItemMs(320);

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
  const station = {
    track: track("Song A", Date.now() - 60_000) as Track | null,
    /** Items the station announced before the current one, newest first. */
    recent: [] as Track[],
  };
  const heard = new HeardTrack({
    candidates: () => [station.track, ...station.recent],
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
    expect(t.hearing.elapsedMs()).toBe(AT_TITLE + 20_000);
    expect(t.pump).toHaveBeenCalledTimes(22);
  });

  it("follows the media clock of the readings: an unhandled stall is taken back", () => {
    const t = setup();
    t.hearing.setPlaying(true);
    t.heard.heard("Song A", Date.now(), false, 0);
    t.hearing.titleWasHeard();
    let media = 100;
    const reading = (advanceMs: number, audioMs: number) => {
      vi.advanceTimersByTime(advanceMs);
      media += audioMs / 1000;
      t.hearing.progress({ liveOffset: null, bufferedAhead: 6, position: media, timestamp: Date.now() });
    };
    for (let i = 0; i < 5; i++) reading(1_000, 1_000);
    expect(t.hearing.elapsedMs()).toBe(AT_TITLE + 5_000);
    t.changes.mockClear();
    // Two seconds of stalled audio that never reached the app as a state.
    reading(1_000, 0);
    reading(1_000, 0);
    expect(t.hearing.elapsedMs()).toBe(AT_TITLE + 5_000);
    expect(t.changes).toHaveBeenCalled(); // the lock screen is re-placed too
    reading(1_000, 1_000);
    expect(t.hearing.elapsedMs()).toBe(AT_TITLE + 6_000);
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
    // 64 s on air, 17 s behind, the station clock ahead of its audio.
    expect(t.hearing.elapsedMs()).toBe(47_000 - STATION_AHEAD_OF_AUDIO_MS);
    // The next change is heard: exact again.
    t.station.track = track("Song B", Date.now());
    t.heard.heard("Song B", Date.now(), false, 17_000);
    expect(t.heard.estimated).toBe(false);
    expect(t.hearing.elapsedMs()).toBe(AT_TITLE);
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
      expect(t.hearing.elapsedMs()).toBe(47_000 - STATION_AHEAD_OF_AUDIO_MS);
      t.changes.mockClear();
      for (const lag of jitter) t.play(1, lag);
      expect(t.hearing.position()).toEqual(position);
      expect(t.hearing.elapsedMs()).toBe(47_000 - STATION_AHEAD_OF_AUDIO_MS + jitter.length * 1_000);
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

    it("holds through a brief pause and resumes where the audio was", () => {
      const t = setup();
      t.hearing.setPlaying(true);
      t.play(13, 6);
      t.hearing.setPlaying(false);
      t.hearing.setIntent(false, true);
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS - 1_000);
      t.hearing.recheck();
      expect(t.hearing.mode).toBe("clock");
      expect(t.hearing.position()?.running).toBe(false);
      expect(t.hearing.elapsedMs()).toBe(67_000);
      t.hearing.setIntent(true);
      t.hearing.setPlaying(true);
      t.play(2, 10); // the buffer now trails by the 4 s paused as well
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
      expect(t.hearing.elapsedMs()).toBe(AT_TITLE);
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

    it("recovers from a request jingle shorter than the lag", () => {
      // Song A → a 4.5 s request jingle → Song B, 6 s behind: by the time
      // the jingle's title is heard, the station already announced Song B.
      const t = setup();
      t.hearing.setPlaying(true);
      t.heard.heard("Song A", Date.now(), false, 6_000);
      t.hearing.titleWasHeard();
      t.play(10);
      const songA = t.station.track!;
      const jingle = track(JINGLE, Date.now(), 4_500);
      t.station.track = jingle;
      t.station.recent = [songA];
      t.hearing.stationChanged();
      t.play(4);
      t.station.track = track("Song B", Date.now() - 500);
      t.station.recent = [jingle, songA];
      t.hearing.stationChanged();
      t.play(2);
      t.heard.heard(JINGLE, Date.now(), false, 6_000);
      t.hearing.titleWasHeard();
      // The station data names the jingle: shown as itself, not waiting.
      expect(t.hearing.track).toBe(jingle);
      expect(t.heard.awaitingStation).toBe(false);
      // Song B's title never reaches the player: once overdue, the station's
      // item takes over instead of the jingle staying for the whole song.
      t.play(6 + ICY_OVERDUE_MS / 1000 + 2);
      expect(t.hearing.track?.raw).toBe("Song B");
    });

    it("moves past a title the station never names once it announces a later item", () => {
      const t = jingleThenSongB();
      t.play(8);
      // The player hears a title no station data names (shown as itself)…
      t.heard.heard("Live Show", Date.now(), false, 6_000);
      t.heard.unresolved("Live Show");
      t.play(6 + ICY_OVERDUE_MS / 1000 + 5);
      expect(t.hearing.track?.raw).toBe("Live Show"); // nothing newer known
      // …then the station announces Song C, whose title never arrives.
      t.station.track = track("Song C", Date.now());
      t.hearing.stationChanged();
      t.heard.stationChanged();
      t.play(6 + ICY_OVERDUE_MS / 1000 - 3);
      expect(t.hearing.track?.raw).toBe("Live Show");
      t.play(4);
      expect(t.hearing.track?.raw).toBe("Song C");
    });

    it("a late announcement of an earlier item does not replace a newer title", () => {
      const t = jingleThenSongB();
      t.play(8);
      t.heard.heard("Live Show", Date.now(), false, 6_000);
      t.heard.unresolved("Live Show");
      // The station names an item that started before the title was heard.
      t.station.track = track("Song Late", Date.now() - 20_000);
      t.hearing.stationChanged();
      t.heard.stationChanged();
      t.play(6 + ICY_OVERDUE_MS / 1000 + 5);
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

  it("does not count time before audio ever played", () => {
    const t = setup();
    t.hearing.setIntent(true); // wanted, still connecting
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
    expect(t.hearing.mode).toBe("station"); // nothing wanted, nothing heard
    expect(t.audible.track).toBeNull();
  });

  describe("without audio: the station's live point", () => {
    /** Plays Song A (a title heard, the clock settled), then pauses. */
    const pausedAfterPlaying = () => {
      const t = setup(); // Song A: on air for 60 s
      t.hearing.setPlaying(true);
      t.heard.heard("Song A", Date.now(), false, 0);
      t.hearing.titleWasHeard();
      t.play(20);
      t.heard.setRunning(false);
      t.hearing.setPlaying(false);
      t.hearing.setIntent(false, true);
      return t;
    };

    it("a cold start shows the station's track, running from its start time", () => {
      const t = setup(); // never played
      expect(t.hearing.mode).toBe("station");
      expect(t.hearing.track?.raw).toBe("Song A");
      expect(t.hearing.positionKnown).toBe(true);
      expect(t.hearing.elapsedMs()).toBe(60_000);
      const position = t.hearing.position();
      expect(position).toMatchObject({ elapsedMs: 60_000, running: true });
      vi.advanceTimersByTime(10_000);
      expect(t.hearing.elapsedMs()).toBe(70_000);
      // The same anchor, tick after tick: the stores see nothing change.
      expect(t.hearing.position()).toBe(position);
    });

    it("is not audible: never anchored, the pause's listening state is gone", () => {
      const t = setup();
      expect(t.hearing.anchored).toBe(false);
      expect(t.heard.anchored).toBe(false);
    });

    it("places the live point on the server's clock", () => {
      const t = setup();
      const position = t.hearing.position();
      t.changes.mockClear();
      t.hearing.setClockSkew(30_000, 100); // the device clock is 30 s behind
      expect(t.changes).toHaveBeenCalledTimes(1);
      expect(t.hearing.elapsedMs()).toBe(90_000);
      expect(t.hearing.position()).not.toBe(position);
      t.changes.mockClear();
      t.hearing.setClockSkew(30_000, 100); // the same skew again: nothing moves
      expect(t.changes).not.toHaveBeenCalled();
    });

    it("follows the station's next item as it is announced", () => {
      const t = setup();
      // The real wiring: HeardTrack's display is empty in station mode, so it
      // reports the change (see HeardTrack.abandon) and NowHearing stays quiet
      // — one change, one report.
      const heardChanges = vi.fn();
      t.heard.onChange = heardChanges;
      t.changes.mockClear();
      t.station.track = track("Song B", Date.now() - 2_000);
      t.heard.stationChanged();
      t.hearing.stationChanged();
      expect(heardChanges).toHaveBeenCalledTimes(1);
      expect(t.changes).not.toHaveBeenCalled();
      expect(t.hearing.track?.raw).toBe("Song B");
      expect(t.hearing.elapsedMs()).toBe(2_000);
      expect(t.hearing.anchored).toBe(false);
    });

    it("shows a jingle as well", () => {
      const t = setup();
      t.station.track = track("Rádio Animu - Vinheta", Date.now() - 3_000, 10_000);
      t.hearing.stationChanged();
      expect(t.hearing.track?.raw).toBe("Rádio Animu - Vinheta");
      expect(t.hearing.elapsedMs()).toBe(3_000);
    });

    it("has no position without a usable start time", () => {
      const t = setup();
      t.station.track = { ...track("Live", 0), startTime: undefined } as unknown as Track;
      expect(t.hearing.track?.raw).toBe("Live");
      expect(t.hearing.position()).toBeNull();
      expect(t.hearing.positionKnown).toBe(false);
      t.station.track = track("Bad", Number.NaN);
      expect(t.hearing.position()).toBeNull();
      expect(t.hearing.elapsedMs()).toBeNull();
    });

    it("holds at the start for an item not started yet", () => {
      const t = setup();
      t.station.track = track("Song B", Date.now() + 10_000);
      expect(t.hearing.elapsedMs()).toBe(0);
      vi.advanceTimersByTime(9_000);
      expect(t.hearing.elapsedMs()).toBe(0);
      vi.advanceTimersByTime(6_000);
      expect(t.hearing.elapsedMs()).toBe(5_000);
    });

    it("keeps the item past its length until the station announces the next", () => {
      const t = setup();
      t.station.track = track("Short", Date.now() - 60_000, 30_000);
      expect(t.hearing.track?.raw).toBe("Short");
      expect(t.hearing.position()).toMatchObject({ elapsedMs: 60_000, running: true }); // the UI clamps
      expect(t.hearing.elapsedMs()).toBeNull();
    });

    it("keeps a brief pause's frozen song, then follows the station — on the tick alone", () => {
      const t = pausedAfterPlaying();
      expect(t.hearing.mode).toBe("icy");
      const frozen = t.hearing.elapsedMs();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS - 1);
      t.hearing.recheck();
      expect(t.hearing.mode).toBe("icy");
      expect(t.hearing.elapsedMs()).toBe(frozen);
      t.changes.mockClear();
      vi.advanceTimersByTime(1);
      t.hearing.recheck(); // no other event: the foreground tick
      expect(t.hearing.mode).toBe("station");
      expect(t.changes).toHaveBeenCalledTimes(1);
      expect(t.hearing.anchored).toBe(false);
      expect(t.hearing.position()?.running).toBe(true);
      expect(t.hearing.elapsedMs()).toBe(60_000 + 20_000 + STATION_AFTER_PAUSE_MS);
      expect(t.heard.anchored).toBe(false); // the paused listening position is given up
    });

    it("a pause repeated by status events does not restart the grace", () => {
      const t = pausedAfterPlaying();
      vi.advanceTimersByTime(3_000);
      t.hearing.setIntent(false, true);
      vi.advanceTimersByTime(2_000);
      t.hearing.recheck();
      expect(t.hearing.mode).toBe("station");
    });

    it("follows the station at once when the player stopped or failed", () => {
      const t = pausedAfterPlaying();
      t.changes.mockClear();
      t.hearing.setIntent(false, false); // stopped / error / ended
      expect(t.hearing.mode).toBe("station");
      expect(t.changes).toHaveBeenCalled();
      expect(t.hearing.track?.raw).toBe("Song A");
    });

    it("a pause (or failed play) while connecting leaves nothing to resume", () => {
      const t = setup();
      t.hearing.setIntent(true);
      expect(t.hearing.mode).toBe("icy");
      t.hearing.setIntent(false, true);
      expect(t.hearing.mode).toBe("station");
    });

    it("wanting audio again cancels the grace", () => {
      const t = pausedAfterPlaying();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS + 3_000);
      // Play pressed before the tick noticed: the song resumes, nothing flipped.
      t.hearing.setIntent(true);
      expect(t.hearing.mode).toBe("icy");
      expect(t.heard.anchored).toBe(true);
    });

    it("play from station mode: syncing until the tune-in title anchors, nothing credited", () => {
      const t = pausedAfterPlaying();
      vi.advanceTimersByTime(STATION_AFTER_PAUSE_MS);
      t.hearing.recheck();
      expect(t.hearing.mode).toBe("station");
      t.station.track = track("Song B", Date.now() - 12_000);
      t.hearing.stationChanged();
      t.changes.mockClear();
      // Play: the station's track stays as the placeholder, no longer audible.
      t.hearing.setIntent(true);
      expect(t.hearing.mode).toBe("icy");
      expect(t.changes).toHaveBeenCalled();
      expect(t.hearing.track?.raw).toBe("Song B");
      expect(t.hearing.anchored).toBe(false);
      expect(t.hearing.positionKnown).toBe(false);
      expect(t.hearing.position()).toBeNull();
      // The open, then the first title and the clock settling.
      t.hearing.reopened();
      t.hearing.setPlaying(true);
      t.heard.heard("Song B", Date.now(), true, 4_800);
      t.hearing.titleWasHeard();
      expect(t.hearing.anchored).toBe(false);
      expect(t.audible.track).toBeNull(); // the old song cannot come back
      t.play(4, 10);
      expect(t.hearing.anchored).toBe(true);
      expect(t.hearing.positionKnown).toBe(true);
      expect(t.hearing.track?.raw).toBe("Song B");
      // 16 s on air (12 + 4), 10 s behind, the station clock ahead of its audio.
      expect(t.hearing.elapsedMs()).toBe(6_000 - STATION_AHEAD_OF_AUDIO_MS);
    });

    it("play from a cold start: the placeholder is not audible either", () => {
      const t = setup();
      t.hearing.setIntent(true);
      expect(t.hearing.track?.raw).toBe("Song A");
      expect(t.hearing.anchored).toBe(false);
      expect(t.hearing.position()).toBeNull();
    });
  });
});
