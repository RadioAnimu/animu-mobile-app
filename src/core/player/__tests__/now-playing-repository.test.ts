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
    abortInFlightRequests: vi.fn(),
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
    const { repository, changes, setStreamMetadata } = makeRepository();

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

    // Scalar churn (listener count) is not an identity change: onChange
    // still reports it (badge UI), but refresh() must not claim "changed"
    // — otherwise the media session is re-pushed on every listener tick.
    setStreamMetadata({
      track: makeTrack(),
      listeners: { value: 42 },
    });
    const third = await repository.refresh();
    expect(third).toBe(false);
    expect(changes).toHaveLength(2);
    expect(changes[1]).toEqual({
      trackChanged: false,
      programChanged: false,
      listenersChanged: true,
      playedChanged: false,
      requestedChanged: false,
    });
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

  it("merges fresh history as a newest-first block (feed order preserved)", async () => {
    // The station feeds are newest-first — row 0 is the most recent play.
    // Regression: the old per-row unshift walked this order and REVERSED
    // it, so "last played" displayed oldest-at-top.
    const oldest = makeTrack({ id: "-1", raw: "A - Oldest", duration: 0 });
    const mid = makeTrack({ id: "-2", raw: "B - Mid", duration: 0 });
    const newest = makeTrack({ id: "-3", raw: "C - Newest", duration: 0 });

    let playedFeed: Track[] = [oldest];
    const { repository, changes } = makeRepository({
      getTrackHistory: async (type) => (type === "played" ? playedFeed : []),
    });

    await repository.refreshHistory("played");
    expect(repository.lastPlayedTracks.map((t) => t.raw)).toEqual([
      "A - Oldest",
    ]);
    changes.length = 0;

    // Next poll brings two newer plays → prepended as a block, order kept
    playedFeed = [newest, mid, oldest];
    await repository.refreshHistory("played");

    expect(repository.lastPlayedTracks.map((t) => t.raw)).toEqual([
      "C - Newest",
      "B - Mid",
      "A - Oldest",
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0].playedChanged).toBe(true);
  });

  it("dedupes repeated rows within one payload (first = newest wins)", async () => {
    const first = makeTrack({ id: "-1", raw: "Repeat - Song", duration: 0 });
    const second = makeTrack({
      id: "-1",
      raw: "Repeat - Song",
      duration: 0,
      artwork: "cover-2.jpg",
    });

    const { repository } = makeRepository({
      getTrackHistory: async () => [first, second],
    });

    await repository.refreshHistory("played");

    expect(repository.lastPlayedTracks).toHaveLength(1);
    expect(repository.lastPlayedTracks[0].artwork).toBe("cover-1.jpg");
  });

  it("replaces the requests list when the newest request changes", async () => {
    const initial = makeTrack({ id: "-1", raw: "Old - Request", duration: 0 });
    const { repository, changes } = makeRepository({
      getTrackHistory: async (type) =>
        type === "requests" ? [initial] : [],
    });

    await repository.refresh();
    expect(repository.lastRequestedTracks.map((t) => t.raw)).toEqual([
      "Old - Request",
    ]);
    changes.length = 0;

    // A new request played → full replace with the fresh payload
    const fresh = makeTrack({ id: "-2", raw: "New - Request", duration: 0 });
    repository["options"].fetchers.getTrackHistory = async (type) =>
      type === "requests" ? [fresh, initial] : [];

    await repository.refresh();

    expect(repository.lastRequestedTracks.map((t) => t.raw)).toEqual([
      "New - Request",
      "Old - Request",
    ]);
    expect(changes[0].requestedChanged).toBe(true);
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

  it("dispose() kills the retry chain and blocks all further fetches", async () => {
    const getStreamMetadata = vi.fn(async () => {
      throw new Error("network down");
    });
    const { repository, timer, changes } = makeRepository({
      getStreamMetadata,
    });

    // Failing refresh arms the exponential retry chain
    await repository.refresh();
    expect(timer.scheduled).toHaveLength(1);

    // Teardown must disarm it — an in-flight catch can never re-arm
    repository.dispose();
    expect(timer.scheduled).toHaveLength(0);

    // Every future entry point is a no-op: no fetches, no emissions,
    // no resurrected timers
    await repository.refresh();
    await repository.refreshHistory("played");
    timer.advance(60_000);

    expect(getStreamMetadata).toHaveBeenCalledTimes(1);
    expect(changes).toHaveLength(0);
    expect(timer.scheduled).toHaveLength(0);
  });

  it("expireStuckRefresh() breaks a latched run; its late settler is discarded", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { flush: flushMicrotasks } = installMicrotaskDrain();
      let release!: (v: unknown) => void;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const { repository, changes } = makeRepository({
        getStreamMetadata: vi.fn(() => gate) as NowPlayingFetchers["getStreamMetadata"],
      });

      // Run A: fetch hangs (background — the JS-timer abort never fires)
      const runA = repository.refresh();
      await flushMicrotasks();

      // Watchdog expires the stuck run past the hard limit
      vi.setSystemTime(Date.now() + 31_000);
      repository.expireStuckRefresh();

      // Run B starts immediately on the released latch…
      const runB = repository.refresh();
      await flushMicrotasks();

      // …then the network finally answers — BOTH runs settle with data
      release({
        track: makeTrack({ raw: "New - Song" }),
        listeners: { value: 42 },
      });
      await Promise.allSettled([runA, runB]);

      // Only the current run may write state or emit
      expect(changes).toHaveLength(1);
      expect(changes[0].trackChanged).toBe(true);
      expect(repository.currentTrack?.raw).toBe("New - Song");
      expect(repository.listeners?.value).toBe(42);

      // The latch must be released — a follow-up run goes through
      const followUp = await repository.refresh();
      expect(typeof followUp).toBe("boolean");
    } finally {
      vi.useRealTimers();
    }
  });

  it("expireStuckRefresh() aborts the hung in-flight requests", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { flush: flushMicrotasks } = installMicrotaskDrain();
      const abortInFlightRequests = vi.fn();
      let release!: (v: unknown) => void;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const { repository } = makeRepository({
        getStreamMetadata: vi.fn(
          () => gate,
        ) as NowPlayingFetchers["getStreamMetadata"],
        abortInFlightRequests,
      });

      void repository.refresh();
      await flushMicrotasks();

      vi.setSystemTime(Date.now() + 31_000);
      repository.expireStuckRefresh();

      // The watchdog must cut the hung sockets loose — the fetch's own
      // abort timeout is a JS timer and never fires in the background
      expect(abortInFlightRequests).toHaveBeenCalledTimes(1);

      release({ track: makeTrack(), listeners: { value: 1 } });
      await flushMicrotasks();
    } finally {
      vi.useRealTimers();
    }
  });

  it("expireStuckRefresh() leaves fresh in-flight runs alone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { flush: flushMicrotasks } = installMicrotaskDrain();
      let release!: (v: unknown) => void;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const { repository } = makeRepository({
        getStreamMetadata: vi.fn(() => gate) as NowPlayingFetchers["getStreamMetadata"],
      });

      void repository.refresh();
      await flushMicrotasks();

      // Watchdog well before the hard limit → run keeps its latch
      repository.expireStuckRefresh();
      release({ track: makeTrack(), listeners: { value: 1 } });
      await flushMicrotasks();

      // The run was NOT invalidated — it completed and wrote state
      expect(repository.currentTrack?.raw).toBe("Artist - Title");

      // …and the latch was released by the run itself
      const followUp = await repository.refresh();
      expect(typeof followUp).toBe("boolean");
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Drains the microtask queue without advancing fake timers. */
const installMicrotaskDrain = (): { flush: () => Promise<void> } => {
  const flush = () =>
    new Promise<void>((resolve) => {
      const realSetTimeout = globalThis.setTimeout;
      realSetTimeout(resolve, 0);
    });
  return { flush };
};
