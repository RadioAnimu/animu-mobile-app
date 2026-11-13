import { describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import {
  HeardTrack,
  STATION_AHEAD_OF_AUDIO_MS,
  icyTitleInItemMs,
  type HeardTrackMemory,
} from "@/core/player/stream-playback/heard-track";

/** Where a title is heard in its item on the default (320 kbps) mount. */
const AT_TITLE = icyTitleInItemMs(320);
/** A tune-in before the stream has calibrated: station time less its lead over the audio. */
const AHEAD = STATION_AHEAD_OF_AUDIO_MS;

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
  let skewMs = 0;
  const station = { tracks: initial };
  const heard = new HeardTrack({
    candidates: () => station.tracks,
    stationTrack: () => station.tracks[0] ?? null,
    clockSkew: () => skewMs,
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
    setSkew: (ms: number) => {
      skewMs = ms;
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
    expect(t.heard.elapsedMs()).toBe(AT_TITLE);
    t.advance(10_000);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 10_000);
    expect(t.changes).toHaveBeenCalledTimes(1);
  });

  it("counts from the moment it was heard, not when the event was handled", () => {
    const t = setup([track("Song A", 0)]);
    const heardAt = t.now - 300;
    t.heard.heard("Song A", heardAt, false, 0);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 300);
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
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 2_000);
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
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 5_000);
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
    expect(t.heard.elapsedMs()).toBe(52_000 - AHEAD);
  });

  it("corrects the tune-in by the applied clock skew", () => {
    const t = setup();
    t.station.tracks = [track("Live", t.now - 60_000)];
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(60_000 - AHEAD);
    t.setSkew(30_000); // the device clock is 30 s behind
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(90_000 - AHEAD);
  });

  it("hears a title half an ICY block into its item, per mount", () => {
    expect([320, 192, 64].map(icyTitleInItemMs)).toEqual([200, 333, 1_000]);
    const t = setup([track("Song A", 0)]);
    t.heard.useStream("64", 64);
    t.heard.heard("Song A", t.now, false, 0);
    expect(t.heard.elapsedMs()).toBe(1_000);
  });

  it("calibrates the tune-in per stream from the changes it hears", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("64k", 64);
    // Titles are heard 1 s into their item here, and the lag reads 5 s
    // short: each change is heard when the station clock says 6.2 s in.
    const change = (raw: string) => {
      t.advance(200_000);
      t.station.tracks = [track(raw, t.now - 12_200)];
      t.heard.heard(raw, t.now, false, 6_000);
    };
    // Before any change: the station clock's usual lead over the audio.
    expect(t.heard.tuneInBiasMs).toBe(AHEAD);
    change("S1");
    // At a change the heard title is the truth: no estimate involved.
    expect(t.heard.elapsedMs()).toBe(1_000);
    // Far from the usual lead: held until the next change agrees.
    expect(t.heard.tuneInBiasMs).toBe(AHEAD);
    change("S2");
    expect(t.heard.tuneInBiasMs).toBe(5_200);
    // A song whose start the API got wrong is not a sample.
    t.advance(200_000);
    t.station.tracks = [track("Live show", t.now - 600_000)];
    t.heard.heard("Live show", t.now, false, 6_000);
    expect(t.heard.tuneInBiasMs).toBe(5_200);
    // The next tune-in is corrected by it: 60 s on air, 6 s lag, 5.2 s bias.
    t.station.tracks = [track("Live", t.now - 60_000)];
    t.heard.reopened();
    t.heard.heard("Live", t.now, true, 6_000);
    expect(t.heard.elapsedMs()).toBe(48_800);
    // Another stream has its own (none yet); a lined-up switch carries the
    // audio on, so the tune-in keeps the calibration it was placed with.
    t.heard.useStream("192k", 192);
    expect(t.heard.tuneInBiasMs).toBe(AHEAD);
    expect(t.heard.placedBiasMs).toBe(5_200);
    t.heard.useStream("64k", 64);
    expect(t.heard.tuneInBiasMs).toBe(5_200);
  });

  it("does not take one far-off change as a stream's calibration (a lag misread across a stall)", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("192", 192);
    const inItem = icyTitleInItemMs(192);
    // A change heard `offMs` later than station time less the lag puts it.
    const change = (raw: string, offMs: number) => {
      t.advance(200_000);
      t.station.tracks = [track(raw, t.now - 6_000 - inItem - offMs)];
      t.heard.heard(raw, t.now, false, 6_000);
    };
    // The stream's first change, its lag read 12.7 s short (a stall): held.
    change("S1", 12_900);
    expect(t.heard.tuneInBiasMs).toBe(AHEAD);
    // The next one does not agree: the far one is dropped.
    change("S2", 150);
    expect(t.heard.tuneInBiasMs).toBe(150);
    change("S3", 12_900);
    change("S4", 250);
    expect(t.heard.tuneInBiasMs).toBe(250);
    // A tune-in is placed with it: 60 s on air, 6 s lag.
    t.station.tracks = [track("Live", t.now - 60_000)];
    t.heard.reopened();
    t.heard.heard("Live", t.now, true, 6_000);
    expect(t.heard.elapsedMs()).toBe(60_000 - 6_000 - 250);
  });

  it("a stream not calibrated yet borrows the calibration of its codec's streams", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("320", 320, "MP3");
    const change = (raw: string, offMs: number) => {
      t.advance(200_000);
      t.station.tracks = [track(raw, t.now - 6_000 - AT_TITLE - offMs)];
      t.heard.heard(raw, t.now, false, 6_000);
    };
    change("S1", 700);
    change("S2", 860);
    expect(t.heard.tuneInBiasMs).toBe(860);
    // A switch that was not lined up places the song on 192 as a tune-in:
    // the other MP3 mount's calibration, not the usual lead.
    t.heard.useStream("192", 192, "MP3");
    expect(t.heard.tuneInBiasMs).toBe(860);
    // The AAC+ mount reads differently: the usual lead until it has its own.
    t.heard.useStream("64", 64, "AAC+");
    expect(t.heard.tuneInBiasMs).toBe(AHEAD);
  });

  it("a reconnect into an airing whose start was heard is placed exactly, at the lag measured then", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("320", 320, "MP3");
    // Each change's start found in the audio, 6 s behind live.
    const found = (raw: string, biasMs: number) => {
      t.advance(200_000);
      t.station.tracks = [track(raw, t.now - 6_000 - biasMs)];
      t.heard.heard(raw, t.now, false, 6_000, true);
    };
    found("T", 2_000);
    found("U", 2_500);
    found("S", 4_000);
    // The stream's calibration is the median (2.5 s); S's own airing is 4 s.
    expect(t.heard.tuneInBiasMs).toBe(2_500);
    // A tunnel: the connection drops in S and comes back 30 s later, 9 s behind live.
    t.heard.reopened();
    t.advance(30_000);
    t.heard.heard("S", t.now, true, 9_000);
    // S is heard 30 s after its start was, and 3 s further behind live now: 27 s in.
    expect(t.heard.elapsedMs()).toBe(27_000);
  });

  it("a start found in a connection's opening audio replaces the tune-in's estimate, unless the calibration rules it out", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("320", 320, "MP3");
    // The stream's calibration: the station leads its audio by 2 s.
    t.advance(200_000);
    t.station.tracks = [track("T", t.now - 6_000 - 2_000)];
    t.heard.heard("T", t.now, false, 6_000, true);
    // A tune-in 4 s into S (station time), 6 s behind live.
    t.advance(200_000);
    t.station.tracks = [track("S", t.now - 12_000)];
    t.heard.reopened();
    t.heard.heard("S", t.now, true, 6_000);
    expect(t.heard.elapsedMs()).toBe(4_000);
    // A gap 9 s back: the start of the jingle before S, or silence that is not a start.
    expect(t.heard.placeStart(t.now - 9_000, 6_000)).toBe(false);
    expect(t.heard.elapsedMs()).toBe(4_000);
    // S's own start, 4.3 s back.
    expect(t.heard.placeStart(t.now - 4_300, 6_000)).toBe(true);
    expect(t.heard.elapsedMs()).toBe(4_300);
    expect(t.heard.memory().airings.at(-1)?.[1]).toBe(1_700);
  });

  it("places a change with no start in the audio by where the stream's titles were found to be", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("320", 320, "MP3");
    // Before any was measured: the protocol's half block.
    expect(t.heard.titleInItemMs).toBe(AT_TITLE);
    // Three changes whose start was found: the audio came 100, 150 and 1200 ms (a silent lead-in) after the title.
    for (const offset of [-100, -1_200, -150]) t.heard.learnTitleOffset(offset);
    expect(t.heard.titleInItemMs).toBe(-150);
    // A crossfade: taken to start 150 ms after its title, and running from there.
    t.advance(200_000);
    t.station.tracks = [track("Mixed in", t.now - 6_000)];
    t.heard.heard("Mixed in", t.now, false, 6_000);
    expect(t.heard.elapsedMs()).toBe(0);
    t.advance(1_150);
    expect(t.heard.elapsedMs()).toBe(1_000);
    // Each stream has its own, kept across a restart.
    t.heard.useStream("64", 64, "AAC+");
    expect(t.heard.titleInItemMs).toBe(icyTitleInItemMs(64));
    const next = setup([track("Old", 0)]);
    next.heard.remember(t.heard.memory());
    next.heard.useStream("320", 320, "MP3");
    expect(next.heard.titleInItemMs).toBe(-150);
  });

  it("a title shown while its start is looked for teaches nothing, and is placed again once it is known", () => {
    const t = setup([track("Old", 0)]);
    t.heard.useStream("320", 320, "MP3");
    t.advance(200_000);
    t.station.tracks = [track("Next", t.now - 6_500)];
    t.heard.preview("Next", t.now);
    expect(t.heard.track?.raw).toBe("Next");
    expect(t.heard.elapsedMs()).toBe(AT_TITLE);
    expect(t.heard.memory().calibration).toEqual({});
    // Its start is found 400 ms after the title was heard, 6 s behind live.
    t.advance(400);
    t.heard.heard("Next", t.now, false, 6_000, true);
    expect(t.heard.elapsedMs()).toBe(0);
    expect(t.heard.tuneInBiasMs).toBe(900);
    // Placed for good: the same title again changes nothing.
    t.advance(5_000);
    t.heard.heard("Next", t.now, false, 6_000, true);
    expect(t.heard.elapsedMs()).toBe(5_000);
  });

  it("what it learned outlives a restart", () => {
    const first = setup([track("Old", 0)]);
    first.heard.useStream("320", 320, "MP3");
    first.station.tracks = [track("S", first.now - 6_700)];
    first.heard.heard("S", first.now, false, 6_000, true);
    const learned = vi.fn();
    first.heard.onLearned = learned;
    first.station.tracks = [track("T", first.now - 6_800)];
    first.heard.heard("T", first.now, false, 6_000, true);
    expect(learned).toHaveBeenCalled();
    const memory = JSON.parse(JSON.stringify(first.heard.memory())) as HeardTrackMemory;
    // The app restarts: a new tracker, the same memory.
    const next = setup([track("T", first.now - 6_800)]);
    next.heard.useStream("320", 320, "MP3");
    next.heard.remember(memory);
    expect(next.heard.tuneInBiasMs).toBe(first.heard.tuneInBiasMs);
    // T's airing is placed as exactly as before the restart.
    next.advance(first.now - next.now + 20_000);
    next.heard.heard("T", next.now, true, 6_000);
    expect(next.heard.elapsedMs()).toBe(20_000);
    // Garbage in storage changes nothing.
    next.heard.remember({ calibration: { "320": ["x" as unknown as number] }, airings: [[1 as unknown as string, 2]] });
    expect(next.heard.tuneInBiasMs).toBe(first.heard.tuneInBiasMs);
  });

  it("follows the player's media clock: a stall handled late is taken back", () => {
    const t = setup([track("Song A", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    expect(t.heard.alignToMedia(50, t.now)).toBe(false); // the reference
    t.advance(4_000);
    expect(t.heard.alignToMedia(54, t.now)).toBe(false);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 4_000);
    // A 1.5 s stall the app never handled: the media clock stood still.
    t.advance(1_500);
    expect(t.heard.alignToMedia(54, t.now)).toBe(true);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 4_000);
    // A pause handled late (after 800 ms) is taken back too.
    t.advance(800);
    t.heard.setRunning(false);
    expect(t.heard.alignToMedia(54, t.now)).toBe(true);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 4_000);
    t.heard.setRunning(true);
    t.advance(1_000);
    expect(t.heard.alignToMedia(55, t.now)).toBe(false);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 5_000);
  });

  it("takes a new reference with every placed title and after a restarted media clock", () => {
    const t = setup([track("Song A", 0), track("Song B", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    t.heard.alignToMedia(50, t.now);
    t.advance(10_000);
    t.heard.heard("Song B", t.now, false, 0);
    // Song B's position is the title's, whatever the media clock said of A.
    expect(t.heard.alignToMedia(60, t.now)).toBe(false);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE);
    t.advance(1_000);
    expect(t.heard.alignToMedia(0.1, t.now)).toBe(false); // a new connection
    t.advance(1_000);
    expect(t.heard.alignToMedia(1.1, t.now)).toBe(false);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 2_000);
  });

  it("freezes the position while audio does not flow", () => {
    const t = setup([track("Song A", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    t.advance(5_000);
    t.heard.setRunning(false);
    t.advance(60_000);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 5_000);
    t.heard.setRunning(true);
    t.advance(1_000);
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 6_000);
  });

  it("ignores a repeated title, but re-places it after a re-open", () => {
    const t = setup([track("Song A", 0)]);
    t.heard.heard("Song A", t.now, false, 0);
    t.advance(30_000);
    t.heard.heard("Song A", t.now, false, 0); // e.g. a new connection's first block
    expect(t.heard.elapsedMs()).toBe(AT_TITLE + 30_000);
    expect(t.changes).toHaveBeenCalledTimes(1);

    t.heard.reopened();
    expect(t.heard.anchored).toBe(false);
    expect(t.heard.track?.raw).toBe("Song A"); // still displayed while re-opening
    t.station.tracks = [track("Song A", t.now - 40_000)];
    t.heard.heard("Song A", t.now, true, 5_000);
    expect(t.heard.elapsedMs()).toBe(35_000 - AHEAD);
  });

  it("abandons the listening session, keeping what belongs to the device", () => {
    const t = setup([track("Song B", 0), track("Song A", 0)]);
    t.heard.useStream("low", 64);
    t.heard.heard("Song A", t.now, false, 0);
    expect(t.heard.track?.raw).toBe("Song A");
    t.heard.heard("Song C", t.now, false, 0); // pending: the station has not named it
    t.changes.mockClear();
    t.heard.abandon();
    // Back on the station's current track, nothing heard, no position.
    expect(t.heard.track?.raw).toBe("Song B");
    expect(t.heard.anchored).toBe(false);
    expect(t.heard.position).toBeNull();
    expect(t.heard.awaitingStation).toBe(false);
    // The pending title is gone: naming it later adopts nothing.
    t.station.tracks = [track("Song C", 0), ...t.station.tracks];
    t.heard.stationChanged();
    expect(t.heard.track?.raw).toBe("Song C");
    expect(t.heard.anchored).toBe(false);
    // Unlike a re-open it reports nothing itself; the owner does.
    expect(t.changes).toHaveBeenCalledTimes(1); // only `stationChanged`, the display having none
  });

  it("matches a title that differs only in Unicode form, case, spacing or escaped quotes", () => {
    const station = "Haruka - Kimi no Na wa' | Anime [Música pedida por ness.js]";
    const t = setup([track(station, 0)]);
    // NFD "ú", lower case, doubled space, an encoder-escaped quote.
    const heard = "haruka -  kimi no na wa\\' | anime [Mu\u0301sica pedida por ness.js]";
    t.heard.heard(heard, t.now, false, 0);
    expect(t.heard.track?.raw).toBe(station);
    expect(t.heard.awaitingStation).toBe(false);
  });

  it("does not loosely match a different song", () => {
    const t = setup([track("Artist - Song", 0)]);
    t.heard.heard("Artist - Song 2", t.now, false, 0);
    expect(t.heard.awaitingStation).toBe(true);
  });

  it("matches the previous song from the history (the speaker is behind the station)", () => {
    const t = setup([track("Announced", 0), track("Still playing", 0)]);
    t.heard.heard("Still playing", t.now, false, 0);
    expect(t.heard.track?.raw).toBe("Still playing");
  });

  it("reports no position past the song's end, and clamps tune-ins", () => {
    const t = setup([track("Short", 0, 10_000)]);
    t.heard.heard("Short", t.now, false, 0);
    t.advance(10_000);
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
