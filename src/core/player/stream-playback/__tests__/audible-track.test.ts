import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import { AudibleTrackResolver } from "@/core/player/stream-playback/audible-track";
import {
  createFakeTimer,
  type FakeTimer,
} from "@/core/player/__tests__/fake-timer";

const makeTrack = (overrides: Partial<Track> = {}): Track =>
  ({
    id: "1",
    raw: "Artist - Title",
    title: "Title",
    artist: "Artist",
    anime: "Anime",
    artworks: {},
    artwork: "cover.jpg",
    duration: 60_000,
    isRequest: false,
    startTime: new Date(1_000_000),
    playlistName: "",
    ...overrides,
  }) as Track;

interface Fixture {
  resolver: AudibleTrackResolver;
  timer: FakeTimer;
  /** Advance virtual time on BOTH the timer and the sync clock. */
  advance: (ms: number) => void;
  /** Advance only the wall clock (drives the pending safety cap). */
  advanceWall: (ms: number) => void;
  setStation: (track: Track | null) => void;
  /** Toggle whether the sync engine has a measured lag. */
  setMeasured: (value: boolean) => void;
  /** How far the audible clock trails the raw clock (the stream lag). */
  setLag: (ms: number) => void;
  /** Current virtual clock (epoch-ish ms). */
  now: () => number;
}

const makeFixture = (): Fixture => {
  const timer = createFakeTimer();
  let clock = 1_000_000;
  let wall = 5_000_000;
  let station: Track | null = null;
  let measured = true;
  let lag = 0;

  const resolver = new AudibleTrackResolver({
    getStationTrack: () => station,
    sync: {
      now: () => clock - lag,
      isAudible: (startTimeMs: number) => clock - lag >= startTimeMs,
      get hasMeasurement() {
        return measured;
      },
    },
    timer,
    nowMs: () => wall,
  });

  return {
    resolver,
    timer,
    now: () => clock,
    advance: (ms) => {
      clock += ms;
      wall += ms;
      timer.advance(ms);
    },
    advanceWall: (ms) => {
      wall += ms;
    },
    setStation: (track) => {
      station = track;
    },
    setMeasured: (value) => {
      measured = value;
    },
    setLag: (ms) => {
      lag = ms;
    },
  };
};

describe("AudibleTrackResolver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adopts an already-audible track immediately", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));

    expect(f.resolver.reconcile()).toBe(true);
    expect(f.resolver.track?.raw).toBe("A");
  });

  it("adopts on a cold start even when the announced track is buffered", () => {
    const f = makeFixture();
    // Nothing on screen yet — better to show the announced track than blank.
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() + 5_000) }));

    expect(f.resolver.reconcile()).toBe(true);
    expect(f.resolver.track?.raw).toBe("A");
  });

  it("holds the previous track until the announced one is audible", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();

    // B starts 5s in the future on the audible clock.
    f.setStation(makeTrack({ raw: "B", startTime: new Date(f.now() + 5_000) }));
    expect(f.resolver.reconcile()).toBe(false);
    expect(f.resolver.track?.raw).toBe("A"); // still the heard track

    f.advance(5_000);
    expect(f.resolver.track?.raw).toBe("B");
  });

  it("fires onChange on a deferred adoption", () => {
    const f = makeFixture();
    const onChange = vi.fn();
    f.resolver.onChange = onChange;

    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();

    f.setStation(makeTrack({ raw: "B", startTime: new Date(f.now() + 3_000) }));
    f.resolver.reconcile();
    expect(onChange).not.toHaveBeenCalled();

    f.advance(3_000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(f.resolver.track?.raw).toBe("B");
  });

  it("does not re-emit for the same on-air item", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    expect(f.resolver.reconcile()).toBe(true);

    // A fresh object for the same rawtitle/artwork (HTTP re-fetch).
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    expect(f.resolver.reconcile()).toBe(false);
  });

  it("adopts a pending track early when the lag shrinks (heartbeat re-check)", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();

    f.setStation(makeTrack({ raw: "B", startTime: new Date(f.now() + 5_000) }));
    f.resolver.reconcile();

    // The stream lag drops: B is now audible without waiting for the timer.
    f.advance(5_000);
    f.resolver.adoptIfDue();

    expect(f.resolver.track?.raw).toBe("B");
  });

  it("holds the displayed track across a re-tune until the new lag is measured", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();
    expect(f.resolver.track?.raw).toBe("A");

    // Relay switched just as B is announced: the clock reset, so B must NOT
    // be adopted on the wall-clock fallback — the new relay is still on A.
    f.setMeasured(false);
    f.resolver.beginReacquire();
    f.setStation(makeTrack({ raw: "B", startTime: new Date(f.now()) }));

    expect(f.resolver.reconcile()).toBe(false);
    expect(f.resolver.track?.raw).toBe("A");

    // The new relay's lag lands (16s behind): B is not audible yet.
    f.setLag(16_000);
    f.setMeasured(true);
    expect(f.resolver.reconcile()).toBe(false);
    expect(f.resolver.track?.raw).toBe("A");

    // Only when the speaker reaches B does the display flip.
    f.advance(16_000);
    expect(f.resolver.track?.raw).toBe("B");
  });

  it("reverts to the previous track when a re-tune lands behind the timeline", () => {
    const f = makeFixture();

    // A → B: B is on screen, A is retained as the previous item.
    f.setStation(
      makeTrack({
        raw: "A",
        startTime: new Date(f.now() - 60_000),
        duration: 120_000,
      }),
    );
    f.resolver.reconcile();
    f.setStation(
      makeTrack({
        raw: "B",
        startTime: new Date(f.now() - 1_000),
        duration: 120_000,
      }),
    );
    expect(f.resolver.reconcile()).toBe(true);
    expect(f.resolver.track?.raw).toBe("B");

    // Switch relay mid-song: the new relay is 16s behind, so the listener is
    // still on A even though the station says B. No pending item exists at
    // this point, so `adoptIfDue` must still re-evaluate the re-tune.
    f.setMeasured(false);
    f.resolver.beginReacquire();
    f.resolver.adoptIfDue();
    expect(f.resolver.track?.raw).toBe("B");

    f.setLag(16_000);
    f.setMeasured(true);
    f.resolver.adoptIfDue();
    expect(f.resolver.track?.raw).toBe("A");

    // …and it re-adopts B once the speaker reaches it.
    f.advance(14_000);
    f.resolver.adoptIfDue();
    expect(f.resolver.track?.raw).toBe("A");
    f.advance(1_000);
    f.resolver.adoptIfDue();
    expect(f.resolver.track?.raw).toBe("B");
  });

  it("never defers when no lag has been measured (pre-sync behaviour)", () => {
    const f = makeFixture();
    f.setMeasured(false);
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();

    // B is announced far ahead, but with no measurement the resolver must
    // adopt it immediately — exactly what the app did before sync existed.
    f.setStation(
      makeTrack({ raw: "B", startTime: new Date(f.now() + 10 * 60_000) }),
    );

    expect(f.resolver.reconcile()).toBe(true);
    expect(f.resolver.track?.raw).toBe("B");
    expect(f.timer.scheduled).toHaveLength(0);
  });

  it("adopts after the safety cap even if the boundary is unreachable", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();

    // B's start is absurdly far ahead — a skewed clock, not a real buffer.
    f.setStation(
      makeTrack({ raw: "B", startTime: new Date(f.now() + 10 * 60_000) }),
    );
    f.resolver.reconcile();
    expect(f.resolver.track?.raw).toBe("A");

    // Past the cap, the heartbeat re-check adopts B regardless.
    f.advanceWall(66_000);
    f.resolver.adoptIfDue();

    expect(f.resolver.track?.raw).toBe("B");
  });

  it("clears the display when the station goes offline (null track)", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();

    f.setStation(null);
    expect(f.resolver.reconcile()).toBe(true);
    expect(f.resolver.track).toBeNull();
  });

  it("reset() clears display and any pending boundary", () => {
    const f = makeFixture();
    f.setStation(makeTrack({ raw: "A", startTime: new Date(f.now() - 1_000) }));
    f.resolver.reconcile();
    f.setStation(makeTrack({ raw: "B", startTime: new Date(f.now() + 5_000) }));
    f.resolver.reconcile();

    f.resolver.reset();

    expect(f.resolver.track).toBeNull();
    expect(f.timer.scheduled).toHaveLength(0);
  });
});
