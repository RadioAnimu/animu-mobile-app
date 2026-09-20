import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import type {
  AudioEnginePort,
  MediaSessionPort,
  NowPlayingMetadata,
} from "@/core/player/ports";
import type { NowPlayingRepository } from "@/core/player/stream-playback/now-playing.repository";
import { ProgressTicker } from "@/core/player/stream-playback/progress-ticker";
import { progressStore } from "@/core/player/store";
import type { TransportStateMachine } from "@/core/player/stream-playback/transport-state";

const METADATA: NowPlayingMetadata = {
  title: "t",
  artist: "a",
  artwork: "c",
  isLiveStream: false,
};

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "1",
  raw: "raw",
  title: "Title",
  artist: "Artist",
  anime: "Naruto",
  artworks: {},
  artwork: "cover.jpg",
  duration: 60_000,
  isRequest: false,
  startTime: new Date(Date.now() - 1000), // elapsed = 1s
  playlistName: "",
  ...overrides,
});

interface Fixture {
  ticker: ProgressTicker;
  track: Track | null;
  showProgress: boolean;
  metadata: NowPlayingMetadata;
  /** Audible clock fed to the ticker; tests may replace it. */
  now: () => number;
  /** Whether the sync engine's estimate has settled. */
  settled: boolean;
  setTrack: (track: Track | null) => void;
  setShowProgress: (value: boolean) => void;
  setSettled: (value: boolean) => void;
  pushes: { metadata: NowPlayingMetadata; positionSec?: number }[];
}

const makeTicker = (): Fixture => {
  const fixture: Fixture = {
    track: null,
    showProgress: true,
    metadata: METADATA,
    now: () => Date.now(),
    settled: true,
    setTrack: (track) => {
      fixture.track = track;
    },
    setShowProgress: (value) => {
      fixture.showProgress = value;
    },
    setSettled: (value) => {
      fixture.settled = value;
    },
    pushes: [],
    ticker: undefined as unknown as ProgressTicker,
  };

  const repository = {
    get currentTrack() {
      return fixture.track;
    },
    get showProgress() {
      return fixture.showProgress;
    },
    setShowProgress: (value: boolean) => fixture.setShowProgress(value),
  } as unknown as NowPlayingRepository;

  const state = {
    get remoteStatus() {
      return "playing" as const;
    },
  } as unknown as TransportStateMachine;

  const audio = {
    get hasPlayer() {
      return true;
    },
  } as unknown as AudioEnginePort;

  const media = {
    get isActive() {
      return true;
    },
    push: vi.fn(
      (metadata: NowPlayingMetadata, _status: unknown, positionSec?: number) => {
        fixture.pushes.push({ metadata, positionSec });
      },
    ),
  } as unknown as MediaSessionPort;

  fixture.ticker = new ProgressTicker({
    repository,
    state,
    audio,
    media,
    sync: {
      now: () => fixture.now(),
      get settled() {
        return fixture.settled;
      },
    },
    buildMetadata: () => fixture.metadata,
  });

  return fixture;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  progressStore.setSnapshot({
    currentTrackProgress: null,
    showProgress: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProgressTicker", () => {
  it("updates the store only when the value changed", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack(); // elapsed = 1000ms under frozen time

    const notifications = vi.fn();
    const unsubscribe = progressStore.subscribe(notifications);

    fixture.ticker.tick();
    expect(notifications).toHaveBeenCalledTimes(1);
    expect(progressStore.getSnapshot()).toEqual({
      currentTrackProgress: 1000,
      showProgress: true,
    });

    fixture.ticker.tick(); // identical snapshot → no notification
    expect(notifications).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:00:01Z")); // elapsed = 2000ms
    fixture.ticker.tick();
    expect(notifications).toHaveBeenCalledTimes(2);
    expect(progressStore.getSnapshot().currentTrackProgress).toBe(2000);

    unsubscribe();
  });

  it("pushes the position to the native session every 3rd tick", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack();

    fixture.ticker.tick();
    fixture.ticker.tick();
    expect(fixture.pushes).toHaveLength(0);

    fixture.ticker.tick();
    expect(fixture.pushes).toEqual([
      { metadata: METADATA, positionSec: 1 },
    ]);
  });

  it("withholds the native position until the lag is measured", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack();
    fixture.setSettled(false);

    fixture.ticker.tick();
    fixture.ticker.tick();
    fixture.ticker.tick();

    // A metadata push still lands (song/status), but with no position so the
    // OS cannot interpolate an unmeasured seek bar.
    expect(fixture.pushes.length).toBeGreaterThan(0);
    expect(
      fixture.pushes.filter((push) => push.positionSec != null),
    ).toHaveLength(0);
  });

  it("does nothing without a track", () => {
    const fixture = makeTicker();
    fixture.setTrack(null);

    fixture.ticker.tick();

    expect(fixture.pushes).toHaveLength(0);
    expect(progressStore.getSnapshot().currentTrackProgress).toBeNull();
  });

  it("detects track end and clears progress + native seek bar", () => {
    const fixture = makeTicker();
    fixture.setTrack(
      makeTrack({ startTime: new Date(Date.now() - 999_999) }), // ended
    );

    fixture.ticker.tick();

    expect(progressStore.getSnapshot()).toEqual({
      currentTrackProgress: null,
      showProgress: false,
    });
    expect(fixture.pushes).toEqual([{ metadata: METADATA, positionSec: 0 }]);
  });

  it("holds progress at 0 while the announced track is still buffered", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack(); // startTime = Date.now() - 1000
    // Audible clock trails the station by 3s → the track has not started.
    fixture.now = () => Date.now() - 3000;

    fixture.ticker.tick();

    expect(progressStore.getSnapshot()).toEqual({
      currentTrackProgress: 0,
      showProgress: true,
    });
    // Held, not cleared — the previous track is still audible.
    expect(fixture.pushes).toEqual([]);
  });

  it("resumes progress once the track reaches the speaker", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack(); // startTime = Date.now() - 1000
    fixture.now = () => Date.now() - 3000;
    fixture.ticker.tick(); // pending → 0

    // The buffer drains: the same track is now audible at 1s elapsed.
    fixture.now = () => Date.now();
    fixture.ticker.tick();

    expect(progressStore.getSnapshot().currentTrackProgress).toBe(1000);
  });

  it("carries the previous track's bar while the next one buffers", () => {
    const fixture = makeTicker();
    let offset = 0;
    fixture.now = () => Date.now() - offset;

    // Track A: playing 5s in, on the live edge.
    fixture.track = makeTrack({
      raw: "A",
      startTime: new Date(Date.now() - 5_000),
    });
    fixture.ticker.tick();
    expect(progressStore.getSnapshot().currentTrackProgress).toBe(5_000);

    // 4s later the relay is 3s behind, and B was announced 2s ahead.
    vi.setSystemTime(new Date(Date.now() + 4_000));
    offset = 3_000;
    fixture.track = makeTrack({
      raw: "B",
      startTime: new Date(Date.now() + 2_000),
    });
    fixture.ticker.tick();

    // A's bar advanced ~1s instead of snapping to B's 0 for the buffer window.
    expect(progressStore.getSnapshot().currentTrackProgress).toBe(6_000);
  });

  it("resets the push cadence when progress toggles on", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack();

    fixture.showProgress = false;
    fixture.ticker.tick(); // observes the toggle → cadence reset
    fixture.showProgress = true;

    fixture.ticker.tick();
    fixture.ticker.tick();
    expect(fixture.pushes).toHaveLength(0); // cadence restarted, not mid-cycle

    fixture.ticker.tick();
    expect(fixture.pushes).toHaveLength(1);
  });

  it("pushes metadata on live streams without a position", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack({ duration: 0 }); // live metadata: no duration
    fixture.showProgress = false;

    fixture.ticker.tick();
    fixture.ticker.tick();
    fixture.ticker.tick();

    expect(fixture.pushes).toEqual([
      { metadata: METADATA, positionSec: undefined },
    ]);
    // No seek bar UI updates for live either — progress stays hidden
    expect(progressStore.getSnapshot().showProgress).toBe(false);
  });

  it("skips redundant live pushes when the metadata is unchanged", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack({ duration: 0 });
    fixture.showProgress = false;

    for (let i = 0; i < 9; i++) fixture.ticker.tick();

    expect(fixture.pushes).toHaveLength(1); // 3rd tick pushes, then dedupe
  });

  it("pushes again on live when the song changes", () => {
    const fixture = makeTicker();
    fixture.track = makeTrack({ duration: 0 });
    fixture.showProgress = false;

    fixture.ticker.tick();
    fixture.ticker.tick();
    fixture.ticker.tick();
    expect(fixture.pushes).toHaveLength(1);

    // DJ drops the next song — repository updated, metadata rebuilt
    fixture.metadata = { ...METADATA, title: "next song" };
    fixture.ticker.tick();
    fixture.ticker.tick();
    fixture.ticker.tick();

    expect(fixture.pushes).toHaveLength(2);
    expect(fixture.pushes[1].metadata.title).toBe("next song");
  });
});