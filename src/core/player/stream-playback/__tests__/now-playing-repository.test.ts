import { describe, expect, it, vi } from "vitest";
import {
  AnimuApiError,
  type ArtworkQuality,
  type Listeners,
  type LiveNowPlaying,
  type Track,
} from "animu-api";
import type { Program } from "@/core/domain/program";
import {
  NowPlayingRepository,
  type NowPlayingChange,
  type NowPlayingFetchers,
} from "@/core/player/stream-playback/now-playing.repository";
import { createFakeTimer, type FakeTimer } from "@/core/player/__tests__/fake-timer";

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
  playlistName: "",
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
    getDefaultCover: () => "default-cover.png",
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

  it("reports a mid-show shout-out toggle as a program change", async () => {
    const fixture = makeRepository();
    fixture.program = makeProgram({ isLive: true, acceptingRequests: true });
    await fixture.repository.refresh();
    fixture.changes.length = 0;

    fixture.program = makeProgram({ isLive: true, acceptingRequests: false });
    await fixture.repository.refresh();

    expect(fixture.repository.currentProgram?.acceptingRequests).toBe(false);
    expect(fixture.changes).toHaveLength(1);
    expect(fixture.changes[0].programChanged).toBe(true);

    fixture.program = makeProgram({ isLive: true, acceptingRequests: true });
    await fixture.repository.refresh();
    expect(fixture.repository.currentProgram?.acceptingRequests).toBe(true);
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
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

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
    infoSpy.mockRestore();
  });

  it("applies the program/request legs when only the metadata leg fails", async () => {
    // One endpoint being down must not blank the rest of the poll: the
    // healthy legs still reach the stores, and the failed one arms exactly
    // one backoff retry.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const { repository, timer } = makeRepository({
        getStreamMetadata: vi.fn(async () => {
          throw new AnimuApiError("Empty response body (expected JSON)", 0, {
            method: "GET",
            url: "https://api.animu.moe/",
          });
        }),
      });

      const changed = await repository.refresh();

      expect(changed).toBe(false); // the run as a whole failed
      expect(repository.currentTrack).toBeNull();

      // …but the independent legs landed.
      expect(repository.currentProgram?.name).toBe("AutoDJ");
      expect(repository.lastRequestedTracks).toHaveLength(1);

      expect(timer.scheduled).toHaveLength(1);
      expect(timer.scheduled[0].ms).toBe(BASE_RETRY_MS);

      // One concise line for the streak: message + url, no object dump.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("Empty response body");
      expect(warn.mock.calls[0][0]).toContain("https://api.animu.moe/");
      expect(info).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });

  it("retries a sibling leg's failure even when the metadata payload is skipped", async () => {
    // The metadata request SUCCEEDED but named no track (the upstream
    // empty-body outage answers 200), while the program leg genuinely
    // failed. The skip path must not swallow that failure: an independent
    // rejected leg made the whole run fail and retry before the split.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const getCurrentProgram = vi.fn(async () => {
        throw new AnimuApiError("Empty response body (expected JSON)", 0, {
          method: "GET",
          url: "https://api.animu.moe/",
        });
      });
      const fixture = makeRepository({ getCurrentProgram });
      fixture.setStreamMetadata({ track: null, listeners: { value: 5 } });

      expect(await fixture.repository.refresh()).toBe(false);
      expect(fixture.repository.currentTrack).toBeNull();

      // The skip warns on its own, and the failed program leg gets its line.
      expect(warn).toHaveBeenCalledTimes(2);
      expect(
        warn.mock.calls.some(([line]) =>
          String(line).includes("invalid track data"),
        ),
      ).toBe(true);
      expect(
        warn.mock.calls.some(([line]) =>
          String(line).includes("Empty response body"),
        ),
      ).toBe(true);

      // The retry chain is armed and fires another run.
      expect(fixture.timer.scheduled).toHaveLength(1);
      expect(fixture.timer.scheduled[0].ms - fixture.timer.now).toBe(
        BASE_RETRY_MS,
      );

      fixture.timer.advance(BASE_RETRY_MS);
      await tick();

      expect(getCurrentProgram).toHaveBeenCalledTimes(2);
      // Still one line per streak: the retry re-arms at 2× without a second.
      expect(fixture.timer.scheduled).toHaveLength(1);
      expect(fixture.timer.scheduled[0].ms - fixture.timer.now).toBe(
        BASE_RETRY_MS * 2,
      );
      expect(
        warn.mock.calls.filter(([line]) =>
          String(line).includes("Empty response body"),
        ),
      ).toHaveLength(1);
      expect(info).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });

  it("keeps the no-track skip free of retries while every leg succeeded", async () => {
    // Unchanged behaviour: nothing failed, so there is nothing to retry —
    // the skip stays exactly as it was before the allSettled split.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const fixture = makeRepository();
      fixture.setStreamMetadata({ track: null, listeners: { value: 5 } });

      expect(await fixture.repository.refresh()).toBe(false);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("invalid track data");
      expect(fixture.timer.scheduled).toEqual([]);
      expect(info).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });

  it("re-arms the track-end refresh when a partial failure applies a new track", async () => {
    // The applied part of a partial run can move the track (or flip the
    // program live): the predictive timer must follow the NEW end instead
    // of staying pointed at the old track's, while the retry chain keeps
    // its own backoff.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const fixture = makeRepository();
      await fixture.repository.refresh();
      const oldTrack = fixture.repository.currentTrack!;
      const oldEndTimer = fixture.timer.scheduled.find(
        (call) => call.ms > 100_000,
      );
      expect(oldEndTimer).toBeTruthy();

      // Next poll: the station moved on and the requests leg failed.
      fixture.setStreamMetadata({
        track: makeTrack({
          raw: "New - Song",
          duration: 60_000,
          startTime: new Date(Date.now() - 50_000),
        }),
        listeners: { value: 10 },
      });
      fixture.repository["options"].fetchers.getTrackHistory = async (type) => {
        if (type === "requests") {
          throw new AnimuApiError("Empty response body (expected JSON)", 0, {
            method: "GET",
            url: "https://api.animu.moe/",
          });
        }
        return [];
      };

      expect(await fixture.repository.refresh()).toBe(false);

      const newTrack = fixture.repository.currentTrack!;
      expect(newTrack.raw).toBe("New - Song");
      expect(newTrack.raw).not.toBe(oldTrack.raw);

      // The old timer is gone; the live one targets the new track's end
      // (≈ 10s remaining + buffer), not the old track's ~170s.
      expect(
        fixture.timer.scheduled.some((call) => call.id === oldEndTimer!.id),
      ).toBe(false);
      const endTimers = fixture.timer.scheduled.filter(
        (call) => call.ms - fixture.timer.now !== BASE_RETRY_MS,
      );
      expect(endTimers).toHaveLength(1);
      const endDelay = endTimers[0].ms - fixture.timer.now;
      expect(endDelay).toBeGreaterThan(9_000);
      expect(endDelay).toBeLessThan(11_000);

      // …and the partial failure still armed its own retry.
      expect(
        fixture.timer.scheduled.filter(
          (call) => call.ms - fixture.timer.now === BASE_RETRY_MS,
        ),
      ).toHaveLength(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("Empty response body");
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });

  it("logs one line per failure streak and one on recovery", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let failing = true;
      const { repository, timer } = makeRepository({
        getStreamMetadata: vi.fn(async () => {
          if (failing) {
            throw new AnimuApiError("Empty response body (expected JSON)", 0, {
              method: "GET",
              url: "https://api.animu.moe/",
            });
          }
          return { track: makeTrack(), listeners: { value: 1 } };
        }),
      });

      // First failure + two retries of the backoff chain → still ONE line.
      await repository.refresh();
      expect(warn).toHaveBeenCalledTimes(1);

      timer.advance(BASE_RETRY_MS);
      await tick();
      expect(warn).toHaveBeenCalledTimes(1);

      timer.advance(BASE_RETRY_MS * 2);
      await tick();
      expect(warn).toHaveBeenCalledTimes(1);

      // Recovery closes the streak with a single line.
      failing = false;
      timer.advance(BASE_RETRY_MS * 4);
      await tick();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();

      // A new streak logs again.
      failing = true;
      await repository.refresh();
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
      info.mockRestore();
      error.mockRestore();
    }
  });

  it("keeps non-API failures on console.error, still once per streak", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { repository, timer } = makeRepository({
        getStreamMetadata: vi.fn(async () => {
          throw new TypeError("unexpected shape");
        }),
      });

      await repository.refresh();
      timer.advance(BASE_RETRY_MS);
      await tick();

      // A programming error is a genuine bug: it keeps the object and the
      // `error` level, but the retry chain must not repeat it verbatim.
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][1]).toBeInstanceOf(TypeError);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
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

  it("schedules track-end on the audible clock when one is injected", async () => {
    const { timer, repository } = makeRepository();
    // Audible clock trails the station by 5s (stream buffer).
    repository["options"].getNow = () => Date.now() - 5_000;

    await repository.refresh();

    const trackEndTimer = timer.scheduled.find((call) => call.ms > 1000);
    expect(trackEndTimer).toBeTruthy();
    // ≈ duration - elapsed + lag + buffer = 180s - 10s + 5s + 0.5s
    expect(trackEndTimer!.ms).toBeGreaterThan(174_000);
    expect(trackEndTimer!.ms).toBeLessThanOrEqual(175_500);
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

  it("passes the user's artwork quality and default cover to every fetch", async () => {
    const getStreamMetadata = vi.fn(async () => ({
      track: makeTrack(),
      listeners: { value: 10 },
    }));
    const getTrackHistory = vi.fn(async () => [makeTrack()]);
    const { repository } = makeRepository({
      getStreamMetadata,
      getTrackHistory,
    });

    await repository.refresh();
    await repository.refreshHistory("played");
    await tick();

    expect(getStreamMetadata).toHaveBeenCalledWith(
      "medium",
      "default-cover.png",
    );
    expect(getTrackHistory).toHaveBeenCalledWith(
      "requests",
      "medium",
      "default-cover.png",
    );
    expect(getTrackHistory).toHaveBeenCalledWith(
      "played",
      "medium",
      "default-cover.png",
    );
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

  it("caps the played history so a long session can't grow unbounded", async () => {
    const many: Track[] = Array.from({ length: 400 }, (_, i) =>
      makeTrack({
        id: `t-${i}`,
        raw: `Track ${i}`,
        startTime: new Date(Date.now() - i * 1000),
      }),
    );
    const { repository } = makeRepository({
      getTrackHistory: vi.fn(async (type) => (type === "played" ? many : [])),
    });

    await repository.refreshHistory("played");

    expect(repository.lastPlayedTracks).toHaveLength(300);
    expect(repository.lastPlayedTracks[0].raw).toBe("Track 0");
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
    // The metadata leg failed, but the program/requests legs still landed
    // (independent legs) — that emission is legitimate; only the ones AFTER
    // teardown are not.
    const changesBeforeDispose = changes.length;

    // Teardown must disarm it — an in-flight catch can never re-arm
    repository.dispose();
    expect(timer.scheduled).toHaveLength(0);

    // Every future entry point is a no-op: no fetches, no emissions,
    // no resurrected timers
    await repository.refresh();
    await repository.refreshHistory("played");
    timer.advance(60_000);

    expect(getStreamMetadata).toHaveBeenCalledTimes(1);
    expect(changes).toHaveLength(changesBeforeDispose);
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

// ─── Live SSE ingestion ───

describe("NowPlayingRepository — live SSE ingestion", () => {
  const makeLiveNowPlaying = (
    track: Track | null,
    listeners = 10,
  ): LiveNowPlaying => ({
    track,
    listeners: { value: listeners },
    serverName: "Animu FM",
    status: "autodj",
    rawTitle: track?.raw ?? "Rádio Animu - Offline | Voltamos já!",
    album: "",
    offlineSince: null,
    message: null,
    receivedAt: new Date(),
  });

  interface LiveHandlers {
    onSongChange: (song: LiveNowPlaying) => void;
    onListeners: (listeners: Listeners) => void;
    // Optional exactly like the fetcher surface; the repository always
    // registers both.
    onOpen?: () => void;
    onError?: (error: Error) => void;
  }

  interface LiveFixture extends Fixture {
    pushSong: (track: Track | null, listeners?: number) => void;
    pushListeners: (value: number) => void;
    pushOpen: () => void;
    pushError: () => void;
    getStreamMetadataSpy: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  }

  const withLive = (): LiveFixture => {
    let captured: LiveHandlers | null = null;
    const unsubscribe = vi.fn();
    const getStreamMetadataSpy = vi.fn(async () => ({
      track: makeTrack({ raw: "Http - Fallback", duration: 300_000 }),
      listeners: { value: 77 },
    }));

    const fixture = makeRepository({
      getStreamMetadata: getStreamMetadataSpy,
      subscribeLive: (
        _quality: ArtworkQuality,
        _cover: string,
        handlers: LiveHandlers,
      ) => {
        captured = handlers;
        return unsubscribe;
      },
    });
    fixture.repository.startLive();
    if (!captured) throw new Error("startLive() did not subscribe");

    const handlers: LiveHandlers = captured;
    return {
      ...fixture,
      // Spread flattens the base getter/setter into a data property, so
      // forward them explicitly to keep `fixture.program = …` wired to the
      // fetcher closure.
      get program() {
        return fixture.program;
      },
      set program(value: Program) {
        fixture.program = value;
      },
      getStreamMetadataSpy,
      unsubscribe,
      pushSong: (track, listeners = 10) =>
        handlers.onSongChange(makeLiveNowPlaying(track, listeners)),
      pushListeners: (value) => handlers.onListeners({ value }),
      pushOpen: () => handlers.onOpen?.(),
      pushError: () => handlers.onError?.(new Error("Live event payload is invalid")),
    };
  };

  it("ingests a song_change push immediately, without an HTTP round-trip", () => {
    const fixture = withLive();
    const onLiveTrackChange = vi.fn();
    fixture.repository.onLiveTrackChange = onLiveTrackChange;

    fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);

    expect(fixture.repository.currentTrack?.raw).toBe("Live - Song");
    expect(fixture.repository.listeners?.value).toBe(12);
    expect(fixture.changes).toEqual([
      {
        trackChanged: true,
        listenersChanged: true,
        programChanged: false,
        playedChanged: false,
        requestedChanged: false,
      },
    ]);
    expect(onLiveTrackChange).toHaveBeenCalledTimes(1);
    const [anchorTrack, anchorAt] = onLiveTrackChange.mock.calls[0];
    expect(anchorTrack.raw).toBe("Live - Song");
    expect(anchorAt).toBeInstanceOf(Date);
    expect(fixture.getStreamMetadataSpy).not.toHaveBeenCalled();
  });

  it("tracks filler pushes but ignores the offline placeholder", () => {
    const fixture = withLive();
    const onLiveTrackChange = vi.fn();
    fixture.repository.onLiveTrackChange = onLiveTrackChange;

    // Filler (jingle/ident/transition) is still the on-air item — the UI
    // and media session must follow it, exactly like the HTTP poll did.
    fixture.pushSong(makeTrack({ raw: "Passagem - Jingle", anime: "Passagem" }));
    fixture.pushSong(null); // offline payload with track: null

    expect(fixture.repository.currentTrack?.raw).toBe("Passagem - Jingle");
    expect(fixture.repository.showProgress).toBe(false);
    expect(fixture.changes).toEqual([
      {
        trackChanged: true,
        listenersChanged: true,
        programChanged: false,
        playedChanged: false,
        requestedChanged: false,
      },
    ]);
    expect(onLiveTrackChange).toHaveBeenCalledTimes(1);
  });

  it("recomputes the media-session progress flag on every live track change", () => {
    const fixture = withLive();

    // Real track, AutoDJ program → seek bar on.
    fixture.pushSong(makeTrack({ raw: "Live - Song" }), 10);
    expect(fixture.repository.showProgress).toBe(true);

    // Filler → seek bar off…
    fixture.pushSong(makeTrack({ raw: "Passagem - Jingle", anime: "Passagem" }));
    expect(fixture.repository.showProgress).toBe(false);

    // …and the next real song turns it back on without waiting for a poll.
    fixture.pushSong(makeTrack({ raw: "Live - Song 2" }));
    expect(fixture.repository.showProgress).toBe(true);
  });

  it("keeps the seek bar off while the program is live", async () => {
    const fixture = withLive();
    fixture.program = makeProgram({ name: "Live Show", isLive: true });

    // The program reaches the repository through the poll first…
    await fixture.repository.refresh();
    // …then a real song arrives over SSE while the show is live.
    fixture.pushSong(makeTrack({ raw: "Live - Song" }), 10);

    expect(fixture.repository.currentTrack?.raw).toBe("Live - Song");
    expect(fixture.repository.showProgress).toBe(false);
  });

  it("lets refresh() skip the HTTP metadata leg while the stream is fresh", async () => {
    const fixture = withLive();

    fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);
    await fixture.repository.refresh();

    // The live source was healthy for the whole polling leg: metadata
    // never fetched, track still the live one, program/history merged.
    expect(fixture.getStreamMetadataSpy).not.toHaveBeenCalled();
    expect(fixture.repository.currentTrack?.raw).toBe("Live - Song");
    expect(fixture.repository.currentProgram?.name).toBe("AutoDJ");
    expect(fixture.repository.lastRequestedTracks).toHaveLength(1);
  });

  it("remembers the items on air before the current one, filler included", () => {
    const fixture = withLive();
    const jingle = makeTrack({ raw: "Rádio Animu - Música pedida por ouvinte! | VHT" });

    fixture.pushSong(makeTrack({ raw: "Song - A" }));
    fixture.pushSong(jingle);
    fixture.pushSong(makeTrack({ raw: "Song - B" }));

    // The request jingle is never in the played history, but a heard title
    // can still name it after the station moved on.
    expect(fixture.repository.currentTrack?.raw).toBe("Song - B");
    expect(fixture.repository.recentOnAirTracks.map((t) => t.raw)).toEqual([
      jingle.raw,
      "Song - A",
    ]);

    // A repeat moves to the front instead of appearing twice.
    fixture.pushSong(makeTrack({ raw: "Song - A" }));
    expect(fixture.repository.recentOnAirTracks.map((t) => t.raw)).toEqual([
      "Song - B",
      jingle.raw,
    ]);

    fixture.repository.clear();
    expect(fixture.repository.recentOnAirTracks).toEqual([]);
  });

  it("forwards the live heartbeat only while subscribed", () => {
    const tickLive = vi.fn();
    const fixture = makeRepository({ tickLive, subscribeLive: () => () => {} });
    fixture.repository.tickLive();
    expect(tickLive).not.toHaveBeenCalled();
    fixture.repository.startLive();
    fixture.repository.tickLive();
    expect(tickLive).toHaveBeenCalledTimes(1);
    fixture.repository.dispose();
    fixture.repository.tickLive();
    expect(tickLive).toHaveBeenCalledTimes(1);
  });

  it("keeps the HTTP metadata leg after an offline push (no track to vouch for)", async () => {
    const fixture = withLive();
    fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);
    fixture.pushSong(null); // the station went offline: the old track stays

    await fixture.repository.refresh();

    expect(fixture.getStreamMetadataSpy).toHaveBeenCalledTimes(1);
    expect(fixture.repository.currentTrack?.raw).toBe("Http - Fallback");
  });

  it("forces the HTTP metadata leg while the stream looks fresh", async () => {
    const fixture = withLive();
    fixture.pushSong(makeTrack({ raw: "Live - Jingle" }), 12);

    // The player heard a title the stream never announced.
    await fixture.repository.refresh({ forceMetadata: true });

    expect(fixture.getStreamMetadataSpy).toHaveBeenCalledTimes(1);
    expect(fixture.repository.currentTrack?.raw).toBe("Http - Fallback");
  });

  it("lets a song_change that lands during a forced run win", async () => {
    const fixture = withLive();
    fixture.pushSong(makeTrack({ raw: "Live - Jingle" }), 12);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fixture.getStreamMetadataSpy.mockImplementationOnce(async () => {
      await gate;
      return { track: makeTrack({ raw: "Http - Stale" }), listeners: { value: 1 } };
    });

    const run = fixture.repository.refresh({ forceMetadata: true });
    fixture.pushSong(makeTrack({ raw: "Live - Song B" }), 12);
    release();
    await run;

    expect(fixture.repository.currentTrack?.raw).toBe("Live - Song B");
  });

  it("runs a forced refresh after the poll already in flight", async () => {
    const fixture = withLive();
    fixture.pushSong(makeTrack({ raw: "Live - Jingle" }), 12);

    // A regular poll skips the metadata leg (the stream is fresh)…
    const poll = fixture.repository.refresh();
    // …so the forced one must not be dropped as a duplicate.
    const forced = fixture.repository.refresh({ forceMetadata: true });
    await Promise.all([poll, forced]);

    expect(fixture.getStreamMetadataSpy).toHaveBeenCalledTimes(1);
    expect(fixture.repository.currentTrack?.raw).toBe("Http - Fallback");
  });

  it("falls back to the HTTP metadata leg past the staleness window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const fixture = withLive();

      fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12); // stamps Date.now()
      vi.setSystemTime(Date.now() + 16_000); // past LIVE_STALE_MS (15s)

      await fixture.repository.refresh();

      // The stream went quiet → the poll reverts to HTTP and the HTTP
      // track replaces the (now stale) live one.
      expect(fixture.getStreamMetadataSpy).toHaveBeenCalledTimes(1);
      expect(fixture.repository.currentTrack?.raw).toBe("Http - Fallback");
      expect(fixture.repository.listeners?.value).toBe(77);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a metadata failure owned by a mid-flight live push is not a failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const fixture = withLive();
      fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);

      let reject!: (reason: Error) => void;
      const gate = new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      });
      fixture.repository["options"].fetchers.getStreamMetadata = vi.fn(
        () => gate,
      ) as unknown as NowPlayingFetchers["getStreamMetadata"];

      // Stream went quiet → this poll runs the HTTP metadata leg.
      vi.setSystemTime(Date.now() + 16_000);
      const poll = fixture.repository.refresh();
      await tick();

      // …then a live push lands mid-flight and re-takes ownership, so the
      // HTTP answer is irrelevant by the time it fails.
      fixture.pushOpen();
      fixture.pushSong(makeTrack({ raw: "Live - Song B" }), 12);

      reject(
        new AnimuApiError("Empty response body (expected JSON)", 0, {
          method: "GET",
          url: "https://api.animu.moe/",
        }),
      );
      await poll;

      expect(fixture.repository.currentTrack?.raw).toBe("Live - Song B");
      // No retry chain and nothing logged: the live stream owns the data.
      expect(
        fixture.timer.scheduled.filter(
          (call) => call.ms - fixture.timer.now === BASE_RETRY_MS,
        ),
      ).toHaveLength(0);
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
      error.mockRestore();
      info.mockRestore();
    }
  });

  it("receives an onOpen stamp so a reconnect re-arms the live source", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const fixture = withLive();
      fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);
      vi.setSystemTime(Date.now() + 16_000); // stale

      // The surface reconnects and re-seeds its state — the poll must
      // trust live again.
      fixture.pushOpen();
      await fixture.repository.refresh();

      expect(fixture.getStreamMetadataSpy).not.toHaveBeenCalled();
      expect(fixture.repository.currentTrack?.raw).toBe("Live - Song");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a dropped song_change is not masked by later listener pushes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fixture = withLive();
      fixture.pushSong(makeTrack({ raw: "Rádio Animu - Vinheta", duration: 10_000 }), 12);
      // The next song's payload failed validation (the client reports it and
      // drops the event); the listener count keeps the stream "fresh".
      fixture.pushError();
      fixture.pushListeners(13);

      await fixture.repository.refresh();

      expect(fixture.getStreamMetadataSpy).toHaveBeenCalledTimes(1);
      expect(fixture.repository.currentTrack?.raw).toBe("Http - Fallback");
    } finally {
      warn.mockRestore();
    }
  });

  it("the next song_change after an error makes the stream the source again", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fixture = withLive();
      fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);
      fixture.pushError();
      fixture.pushOpen(); // reconnected; the seeded song follows
      fixture.pushSong(makeTrack({ raw: "Live - Song 2" }), 12);

      await fixture.repository.refresh();

      expect(fixture.getStreamMetadataSpy).not.toHaveBeenCalled();
      expect(fixture.repository.currentTrack?.raw).toBe("Live - Song 2");
    } finally {
      warn.mockRestore();
    }
  });

  it("dispose() detaches the subscription exactly once", () => {
    const fixture = withLive();

    fixture.repository.dispose();
    fixture.repository.dispose(); // second call is a no-op

    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("listener pushes emit listenersChanged and dedupe repeats", () => {
    const fixture = withLive();

    fixture.pushListeners(42);
    expect(fixture.repository.listeners?.value).toBe(42);
    expect(fixture.changes).toEqual([
      {
        trackChanged: false,
        listenersChanged: true,
        programChanged: false,
        playedChanged: false,
        requestedChanged: false,
      },
    ]);

    // Same value again → deduped, no event
    fixture.pushListeners(42);
    expect(fixture.changes).toHaveLength(1);
  });

  it("a live push landing mid-flight cannot be regressed by the settling HTTP run", async () => {
    const fixture = withLive();
    const { repository } = fixture;

    let release!: (v: { track: Track | null; listeners: Listeners }) => void;
    const gate = new Promise<{ track: Track | null; listeners: Listeners }>(
      (resolve) => {
        release = resolve;
      },
    );
    repository["options"].fetchers.getStreamMetadata = vi.fn(
      () => gate,
    ) as unknown as NowPlayingFetchers["getStreamMetadata"];

    // Poll starts on a quiet stream → HTTP metadata leg runs (hangs on gate)
    const poll = repository.refresh();
    await tick();

    // …and the SSE stream connects and pushes current state mid-flight.
    fixture.pushOpen();
    fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);

    // The HTTP leg finally answers with OLDER data.
    release({
      track: makeTrack({ raw: "Stale - Http" }),
      listeners: { value: 1 },
    });
    await poll;

    // The live push wins: no regression, no spurious change events.
    expect(repository.currentTrack?.raw).toBe("Live - Song");
    expect(repository.listeners?.value).toBe(12);
  });

  // ── Background-idle suspension ──

  const historyCalls = (fixture: Fixture, type: string) =>
    (
      fixture.repository["options"].fetchers.getTrackHistory as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([t]) => t === type);

  describe("when the orchestrator withdraws permission", () => {
    it.each([
      ["song_change", (f: LiveFixture) => f.pushSong(makeTrack({ raw: "Late - Song" }), 12)],
      ["listeners", (f: LiveFixture) => f.pushListeners(99)],
      ["open", (f: LiveFixture) => f.pushOpen()],
    ])("drops a %s event untouched and closes the stream", async (_name, push) => {
      const fixture = withLive();
      let allowed = true;
      fixture.repository.shouldStayLive = () => allowed;
      const onLiveTrackChange = vi.fn();
      fixture.repository.onLiveTrackChange = onLiveTrackChange;

      fixture.pushSong(makeTrack({ raw: "Live - Song" }), 12);
      fixture.changes.length = 0;
      const playedBefore = historyCalls(fixture, "played").length;

      allowed = false;
      push(fixture);
      await tick();

      expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
      expect(fixture.repository.isSuspended).toBe(true);
      // No state write, no onChange, no history fetch, no track hook.
      expect(fixture.repository.currentTrack?.raw).toBe("Live - Song");
      expect(fixture.repository.listeners?.value).toBe(12);
      expect(fixture.changes).toEqual([]);
      expect(onLiveTrackChange).toHaveBeenCalledTimes(1);
      expect(historyCalls(fixture, "played")).toHaveLength(playedBefore);
    });

    it("cancels the track-end refresh and the retry backoff, and nothing re-arms them", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const fixture = withLive();
        let allowed = true;
        fixture.repository.shouldStayLive = () => allowed;
        fixture.pushSong(makeTrack({ raw: "Live - Song", startTime: new Date() }), 12);
        // A failing poll arms the retry backoff next to the track-end timer.
        const fetchers = fixture.repository["options"].fetchers;
        fetchers.getCurrentProgram = vi.fn(async () => {
          throw new Error("offline");
        });
        await fixture.repository.refresh();
        expect(fixture.timer.scheduled).toHaveLength(2);

        allowed = false;
        fixture.pushListeners(50);

        expect(fixture.timer.scheduled).toEqual([]);
        // Nothing comes back by itself, not even for a very late tick.
        fixture.timer.advance(60 * 60_000);
        expect(fixture.timer.scheduled).toEqual([]);
        expect(fetchers.getCurrentProgram).toHaveBeenCalledTimes(1);
      } finally {
        error.mockRestore();
      }
    });

    it("a run in flight at suspension neither writes state nor re-arms a timer when it settles", async () => {
      const fixture = withLive();
      const { repository } = fixture;
      const fetchers = repository["options"].fetchers;
      let release!: (program: Program) => void;
      fetchers.getCurrentProgram = vi.fn(
        () => new Promise<Program>((resolve) => (release = resolve)),
      );
      const run = repository.refresh();
      await tick();

      repository.setLiveStreamActive(false);
      fixture.changes.length = 0;
      release(makeProgram({ name: "Late show" }));

      expect(await run).toBe(false);
      expect(repository.currentProgram).toBeNull();
      expect(fixture.changes).toEqual([]);
      expect(fixture.timer.scheduled).toEqual([]);
    });

    it("a run in flight at suspension is invalidated: a resume refreshes afresh and the late payload is dropped", async () => {
      const fixture = withLive();
      const { repository } = fixture;
      const fetchers = repository["options"].fetchers;
      const releases: ((program: Program) => void)[] = [];
      fetchers.getCurrentProgram = vi.fn(
        () => new Promise<Program>((resolve) => releases.push(resolve)),
      );
      const stale = repository.refresh();
      await tick();

      repository.setLiveStreamActive(false);
      expect(fetchers.abortInFlightRequests).toHaveBeenCalledTimes(1);
      repository.setLiveStreamActive(true);

      // The resume's own refresh is not swallowed by the old run's latch.
      const fresh = repository.refresh();
      await tick();
      expect(fetchers.getCurrentProgram).toHaveBeenCalledTimes(2);

      releases[1](makeProgram({ name: "Fresh show" }));
      await fresh;
      releases[0](makeProgram({ name: "Stale show" }));
      expect(await stale).toBe(false);
      expect(repository.currentProgram?.name).toBe("Fresh show");
    });

    it("a failure in flight at suspension does not schedule a retry", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const fixture = withLive();
        const { repository } = fixture;
        const fetchers = repository["options"].fetchers;
        let fail!: (reason: Error) => void;
        fetchers.getCurrentProgram = vi.fn(
          () => new Promise<Program>((_resolve, reject) => (fail = reject)),
        );
        const run = repository.refresh();
        await tick();

        repository.setLiveStreamActive(false);
        fail(new Error("socket closed"));

        expect(await run).toBe(false);
        expect(fixture.timer.scheduled).toEqual([]);
      } finally {
        error.mockRestore();
      }
    });

    it("refresh() and the history fetch are no-ops until the stream is switched back on", async () => {
      const subscribe = vi.fn((..._args: unknown[]) => () => {});
      const fixture = makeRepository({ subscribeLive: subscribe as never });
      const { repository } = fixture;
      repository.startLive();
      repository.setLiveStreamActive(false);
      expect(repository.isSuspended).toBe(true);
      repository.startLive(); // a stray start does not slip past the suspension
      expect(subscribe).toHaveBeenCalledTimes(1);

      expect(await repository.refresh()).toBe(false);
      await repository.refreshHistory("played");
      expect(fixture.repository["options"].fetchers.getCurrentProgram).not.toHaveBeenCalled();
      expect(historyCalls(fixture, "played")).toEqual([]);

      repository.setLiveStreamActive(true);
      expect(repository.isSuspended).toBe(false);
      expect(subscribe).toHaveBeenCalledTimes(2); // re-attached: the daemon seeds it
      expect(await repository.refresh()).toBe(true);
    });
  });

  describe("while quiet (hidden, nothing playing)", () => {
    it("skips the played-history fetch on a track change and remembers it", async () => {
      const fixture = withLive();
      let quiet = true;
      fixture.repository.isQuiet = () => quiet;

      fixture.pushSong(makeTrack({ raw: "Live - Quiet" }), 12);
      await tick();

      expect(fixture.repository.currentTrack?.raw).toBe("Live - Quiet");
      expect(historyCalls(fixture, "played")).toEqual([]);
      expect(fixture.repository.historyStale).toBe(true);

      // The catch-up fetch clears the mark.
      quiet = false;
      await fixture.repository.refreshHistory("played");
      expect(fixture.repository.historyStale).toBe(false);
      expect(historyCalls(fixture, "played")).toHaveLength(1);
    });

    it("fetches the history as usual when not quiet", async () => {
      const fixture = withLive();
      fixture.pushSong(makeTrack({ raw: "Live - Loud" }), 12);
      await tick();
      expect(historyCalls(fixture, "played")).toHaveLength(1);
      expect(fixture.repository.historyStale).toBe(false);
    });
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
