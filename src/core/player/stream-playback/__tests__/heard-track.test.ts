import { describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import {
  HeardTrack,
  STATION_AHEAD_OF_AUDIO_MS,
  icyTitleInItemMs,
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

  it("corrects the tune-in for a wrong device clock once the skew is significant", () => {
    const t = setup();
    t.station.tracks = [track("Live", t.now - 60_000)];
    // Device clock 1 s off: below the threshold, ignored.
    for (let i = 0; i < 9; i++) t.heard.setClockSkew(1_000, 100);
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(60_000 - AHEAD);
    // 30 s off (median of the window): applied.
    for (let i = 0; i < 9; i++) t.heard.setClockSkew(30_000, 100);
    t.heard.heard("Live", t.now, true, 0);
    expect(t.heard.elapsedMs()).toBe(90_000 - AHEAD);
    // Imprecise samples (long round trip) are ignored.
    t.heard.setClockSkew(-500_000, 9_000);
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
    expect(t.heard.tuneInBiasMs).toBe(5_200);
    change("S2");
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
    // Another stream has its own (none yet).
    t.heard.useStream("192k", 192);
    expect(t.heard.tuneInBiasMs).toBe(AHEAD);
    t.heard.useStream("64k", 64);
    expect(t.heard.tuneInBiasMs).toBe(5_200);
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
