import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NowPlayingMetadata } from "react-native-playback-controls";
import type { Track } from "../../domain/track";
import type { MediaSessionPublisher } from "../media-session.publisher";
import type { NowPlayingRepository } from "../now-playing.repository";
import { ProgressTicker } from "../progress-ticker";
import { progressStore } from "../store";
import type { AudioTransport } from "../transport";
import type { TransportStateMachine } from "../transport-state";

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
  ...overrides,
});

interface Fixture {
  ticker: ProgressTicker;
  track: Track | null;
  showProgress: boolean;
  metadata: NowPlayingMetadata;
  setTrack: (track: Track | null) => void;
  setShowProgress: (value: boolean) => void;
  pushes: { metadata: NowPlayingMetadata; positionSec?: number }[];
}

const makeTicker = (): Fixture => {
  const fixture: Fixture = {
    track: null,
    showProgress: true,
    metadata: METADATA,
    setTrack: (track) => {
      fixture.track = track;
    },
    setShowProgress: (value) => {
      fixture.showProgress = value;
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

  const transport = {
    get isSessionReady() {
      return true;
    },
    get hasPlayer() {
      return true;
    },
  } as unknown as AudioTransport;

  const publisher = {
    push: vi.fn(
      (metadata: NowPlayingMetadata, _status: unknown, positionSec?: number) => {
        fixture.pushes.push({ metadata, positionSec });
      },
    ),
  } as unknown as MediaSessionPublisher;

  fixture.ticker = new ProgressTicker({
    repository,
    state,
    transport,
    publisher,
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