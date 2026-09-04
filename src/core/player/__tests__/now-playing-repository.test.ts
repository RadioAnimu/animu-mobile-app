import { describe, expect, it, vi } from "vitest";
import type { Listeners, Track } from "animu-api";
import type { Program } from "../../domain/program";
import {
  NowPlayingRepository,
  type NowPlayingChange,
  type NowPlayingFetchers,
} from "../now-playing.repository";
import { createFakeTimer, type FakeTimer } from "./fake-timer";

const BASE_RETRY_MS = 2000;

/** Drains every pending microtask (fake timers don't flush promises). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "1",
  raw: "Artist - Title",
  title: "Title",
  artist: "Artist",
  anime: "Naruto",
  artworks: {},
  artwork: "cover-1.jpg",
  duration: 180_000,
  isRequest: false,
  startTime: new Date(Date.now() - 10_000),
  ...overrides,
});

const makeProgram = (overrides: Partial<Program> = {}): Program => ({
  name: "AutoDJ",
  dj: "Haruka Yuki",
  isLive: false,
  imageUrl: "",
  info: "",
  theme: "",
  acceptingRequests: false,
  ...overrides,
});

interface Fixture {
  timer: FakeTimer;
  changes: NowPlayingChange[];
  repository: NowPlayingRepository;
  program: Program;
  setStreamMetadata: (data: {
    track: Track | null;
    listeners: Listeners;
  }) => void;
}

const makeRepository = (
  fetchersOverride: Partial<NowPlayingFetchers> = {},
): Fixture => {
  const timer = createFakeTimer();
  const changes: NowPlayingChange[] = [];

  let metadata: { track: Track | null; listeners: Listeners } = {
    track: makeTrack(),
    listeners: { value: 10 },
  };
  let program = makeProgram();

  const fetchers: NowPlayingFetchers = {
    getStreamMetadata: vi.fn(async () => metadata),
    getCurrentProgram: vi.fn(async () => program),
    // "played" history stays empty by default so the fire-and-forget
    // refresh triggered on track change is deterministic in tests.
    getTrackHistory: vi.fn(async (type) =>
      type === "requests" ? [makeTrack({ id: "-1", isRequest: true, duration: 0 })] : [],
    ),
    ...fetchersOverride,
  };

  const repository = new NowPlayingRepository({
    fetchers,
    getCoverQuality: () => "medium",
    timer,
  });
  repository.onChange = (result) => changes.push(result);

  return {
    timer,
    changes,
    repository,
    get program() {
      return program;
    },
    set program(value: Program) {
      program = value;
    },
    setStreamMetadata: (data) => {
      metadata = data;
    },
  };
};

describe("NowPlayingRepository", () => {
  it("merges data and reports only real changes", async () => {
    const { repository, changes } = makeRepository();

    const first = await repository.refresh();
    expect(first).toBe(true);
    expect(repository.currentTrack?.raw).toBe("Artist - Title");
    expect(repository.currentProgram?.name).toBe("AutoDJ");
    expect(repository.lastRequestedTracks).toHaveLength(1);

    // First fetch: everything changed except the played history
    // (the "played" fetch returns empty by default in fixtures)
    expect(changes).toEqual([
      {
        trackChanged: true,
        programChanged: true,
        listenersChanged: true,
        playedChanged: false,
        requestedChanged: true,
      },
    ]);

    const second = await repository.refresh();
    expect(second).toBe(false);
    expect(changes).toHaveLength(1); // only the first refresh changed things
  });

  it("enables progress only for real, non-live tracks", async () => {
    const fixture = makeRepository();

    await fixture.repository.refresh();
    expect(fixture.repository.showProgress).toBe(true);

    fixture.setStreamMetadata({
      track: makeTrack({ raw: "Passagem - Jingle", anime: "Passagem" }),
      listeners: { value: 10 },
    });
    await fixture.repository.refresh();
    expect(fixture.repository.showProgress).toBe(false);

    fixture.setStreamMetadata({
      track: makeTrack({ raw: "Real Song" }),
      listeners: { value: 10 },
    });
    fixture.program = makeProgram({ isLive: true });
    await fixture.repository.refresh();
    expect(fixture.repository.showProgress).toBe(false);
  });

  it("guards against concurrent refreshes", async () => {
    let releaseMetadata!: () => void;
    const { repository, changes } = makeRepository({
      getStreamMetadata: () =>
        new Promise((resolve) => {
          releaseMetadata = () =>
            resolve({ track: makeTrack(), listeners: { value: 1 } });
        }),
    });

    const first = repository.refresh();
    const second = await repository.refresh();
    expect(second).toBe(false);

    releaseMetadata();
    await first;
    expect(changes).toHaveLength(1); // the blocked call never merged data
  });

  it("skips updates when the API returns no track", async () => {
    const { repository, setStreamMetadata } = makeRepository();
    setStreamMetadata({ track: null, listeners: { value: 5 } });

    const result = await repository.refresh();

    expect(result).toBe(false);
    expect(repository.currentTrack).toBeNull();
    expect(repository.hasTrack).toBe(false);
  });

  it("retries failed refreshes with backoff and resets on success", async () => {
    const { timer, repository, changes } = makeRepository();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let failing = true;
    repository["options"].fetchers.getStreamMetadata = async () => {
      if (failing) throw new Error("network down");
      return { track: makeTrack(), listeners: { value: 1 } };
    };

    await repository.refresh();
    expect(timer.scheduled).toHaveLength(1); // retry armed
    expect(timer.scheduled[0].ms).toBe(BASE_RETRY_MS);

    // Retry fires while still failing → new retry at 2× delay
    timer.advance(BASE_RETRY_MS);
    await tick();
    expect(timer.scheduled).toHaveLength(1);
    expect(timer.scheduled[0].ms - timer.now).toBe(BASE_RETRY_MS * 2);

    // Success clears the retry chain and arms the track-end timer
    failing = false;
    timer.advance(BASE_RETRY_MS * 2);
    await tick();
    expect(timer.scheduled).toHaveLength(1);
    expect(timer.scheduled[0].ms).toBeGreaterThan(1000); // track-end, not retry
    expect(changes.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("schedules a predictive track-end refresh for real, non-live tracks", async () => {
    const { timer, repository } = makeRepository();
    await repository.refresh();

    const track = repository.currentTrack!;
    const trackEndTimer = timer.scheduled.find((call) => call.ms > 1000);

    // ≈ duration - elapsed + buffer = 180s - 10s + 0.5s
    expect(trackEndTimer).toBeTruthy();
    expect(trackEndTimer!.ms).toBeLessThanOrEqual(
      track.duration - 10_000 + 500,
    );
    expect(trackEndTimer!.ms).toBeGreaterThan(100_000);
  });

  it("refreshes soon when the track already ended", async () => {
    const { timer, repository } = makeRepository({
      getStreamMetadata: async () => ({
        track: makeTrack({
          startTime: new Date(Date.now() - 999_999),
        }),
        listeners: { value: 10 },
      }),
    });

    await repository.refresh();

    expect(timer.scheduled).toHaveLength(1);
    expect(timer.scheduled[0].ms).toBe(1000);
  });

  it("does not schedule a track-end refresh for live programs", async () => {
    const { timer, repository } = makeRepository();
    repository["options"].fetchers.getCurrentProgram = async () =>
      makeProgram({ isLive: true });

    await repository.refresh();

    expect(timer.scheduled.filter((call) => call.ms > 1000)).toHaveLength(0);
  });

  it("dedupes history entries and notifies only on additions", async () => {
    const sharedTrack = makeTrack({ id: "-1", isRequest: true, duration: 0 });
    let historyResponse: Track[] = [sharedTrack];
    const { repository, changes } = makeRepository({
      getTrackHistory: async () => historyResponse,
    });
    await repository.refresh();
    await tick(); // drain the fire-and-forget "played" history merge
    changes.length = 0;

    // Same track again → dedupe, nothing added, no notification
    await repository.refreshHistory("played");
    expect(repository.lastPlayedTracks).toHaveLength(1);
    expect(changes).toHaveLength(0);

    // A new track → new array reference + notification
    historyResponse = [makeTrack({ id: "-2", raw: "New - Song" })];
    await repository.refreshHistory("played");

    expect(repository.lastPlayedTracks).toHaveLength(2);
    expect(changes).toEqual([
      {
        trackChanged: false,
        programChanged: false,
        listenersChanged: false,
        playedChanged: true,
        requestedChanged: false,
      },
    ]);
  });

  it("replaces the history array reference when tracks are added", async () => {
    // Store snapshots diff by reference — in-place mutation would never
    // notify subscribers, so refreshHistory must copy-on-write.
    const sharedTrack = makeTrack({ id: "-1", isRequest: true, duration: 0 });
    const { repository, changes } = makeRepository({
      getTrackHistory: async () => [sharedTrack],
    });

    const before = repository.lastPlayedTracks;
    await repository.refreshHistory("played");

    expect(repository.lastPlayedTracks).toHaveLength(1);
    expect(repository.lastPlayedTracks).not.toBe(before);
    expect(changes).toHaveLength(1);
    expect(changes[0].playedChanged).toBe(true);
  });

  it("clears all data", async () => {
    const { repository } = makeRepository();
    await repository.refresh();

    repository.clear();

    expect(repository.currentTrack).toBeNull();
    expect(repository.currentProgram).toBeNull();
    expect(repository.listeners).toBeNull();
    expect(repository.lastPlayedTracks).toHaveLength(0);
    expect(repository.lastRequestedTracks).toHaveLength(0);
    expect(repository.showProgress).toBe(false);
    expect(repository.hasTrack).toBe(false);
  });
});
