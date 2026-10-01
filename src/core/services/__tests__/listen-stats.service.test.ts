import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  ListenStatsService,
  MIN_SESSION_MS,
  dayKeyOf,
} from "@/core/services/listen-stats.service";
import type { Track } from "@/core/domain/track";

const memory = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      memory.delete(key);
    }),
  },
}));

/** Builds a service and waits for its async load to finish. */
const makeService = async (): Promise<ListenStatsService> => {
  const service = new ListenStatsService();
  await service.initialize();
  return service;
};

/** Advances the fake clock to `at` (epoch ms). */
const at = (epochMs: number): void => {
  vi.setSystemTime(epochMs);
};

/** Local midnight of the day `offsetDays` days from today. */
const dayStart = (offsetDays = 0): number => {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

const makeTrack = (
  id: string,
  anime = "Attack on Titan",
  raw = `raw-${id}`,
): Track => ({
  id,
  raw,
  title: `Title ${id}`,
  artist: "Artist",
  anime,
  artworks: {},
  artwork: "",
  duration: 180_000,
  isRequest: false,
  startTime: new Date(),
  playlistName: "",
});

const hearTrack = (
  service: ListenStatsService,
  id: string,
  isRequest = false,
): void => {
  const track = { ...makeTrack(id), isRequest };
  service.onTrackHeard(track, true);
};

describe("listenStatsService", () => {
  beforeEach(() => {
    memory.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(dayStart(0) + 12 * 3_600_000); // today, noon
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accrues audible segments into the current day and hour", async () => {
    const service = await makeService();

    const noon = dayStart(0) + 12 * 3_600_000;
    service.onPlaybackStarted();
    at(noon + 10_000);
    service.onAudibleTick(noon + 10_000);
    at(noon + 20_000);
    service.onAudibleTick(noon + 20_000);
    service.onPlaybackStopped();

    const { days } = service.getSnapshot();
    const today = days[dayKeyOf(noon)];
    expect(today.ms).toBe(20_000);
    expect(today.hours[12]).toBe(20_000);
    expect(today.firstAt).toBe(noon + 10_000);
    expect(today.lastAt).toBe(noon + 20_000);
  });

  it("counts one session only after the 30s minimum", async () => {
    const service = await makeService();

    // Sub-minimum listen — no session counted.
    service.onPlaybackStarted();
    service.onAudibleTick(Date.now() + MIN_SESSION_MS - 5_000);
    service.onPlaybackStopped();
    expect(service.getSnapshot().totalSessions).toBe(0);

    // A real listen — one session.
    service.onPlaybackStarted();
    service.onAudibleTick(Date.now() + MIN_SESSION_MS);
    service.onPlaybackStopped();
    expect(service.getSnapshot().totalSessions).toBe(1);
  });

  it("keeps one session across a stream stall, but splits on pause", async () => {
    const service = await makeService();

    const t0 = Date.now();
    service.onPlaybackStarted();
    service.onAudibleTick(t0 + 40_000); // 40s heard
    // Stall → reconnect 10s later (no pause event): same session continues.
    at(t0 + 50_000);
    service.onPlaybackStarted();
    service.onAudibleTick(t0 + 80_000); // 30 more seconds heard
    service.onPlaybackStopped(); // pause → counts the whole listen as ONE session

    const snap = service.getSnapshot();
    expect(snap.totalSessions).toBe(1);
    expect(snap.totalMs).toBe(70_000); // stall silence never counted

    // New listen after a pause → second session.
    at(t0 + 90_000);
    service.onPlaybackStarted();
    service.onAudibleTick(t0 + 120_000);
    service.onPlaybackStopped();
    expect(service.getSnapshot().totalSessions).toBe(2);
  });

  it("splits listening across midnight into the right days", async () => {
    const service = await makeService();

    const before = dayStart(0) + 23 * 3_600_000 + 59 * 60_000 + 40_000; // 23:59:40
    at(before);
    service.onPlaybackStarted();
    service.onAudibleTick(before + 10_000); // 23:59:50 → today
    at(dayStart(1) + 10_000); // 00:00:10 next day
    service.onAudibleTick(before + 30_000); // segment crosses midnight
    service.onPlaybackStopped();

    const { days } = service.getSnapshot();
    expect(days[dayKeyOf(before)].ms).toBe(20_000);
    expect(days[dayKeyOf(before + 86_400_000)].ms).toBe(10_000);
  });

  it("counts distinct tracks heard while playing, skipping fillers", async () => {
    const service = await makeService();

    hearTrack(service, "a");
    hearTrack(service, "a"); // re-announcement → deduped
    hearTrack(service, "b", true); // a listener request
    service.onTrackHeard(makeTrack("c", "passagem"), true); // filler transition
    service.onTrackHeard(
      makeTrack("d", "Station idents", "Rádio Animu ident 01"),
      true,
    ); // station ident
    service.onTrackHeard(makeTrack("e"), false); // paused

    const snap = service.getSnapshot();
    expect(snap.totalTracks).toBe(2);
    expect(snap.totalRequestTracks).toBe(1);
  });

  it("counts only successful requests and shout-outs", async () => {
    const service = await makeService();

    service.onRequestSubmitted(true);
    service.onRequestSubmitted(false);
    service.onShoutSubmitted(true);
    service.onShoutSubmitted(false);

    const snap = service.getSnapshot();
    expect(snap.totalSubmitted).toBe(1);
    expect(snap.totalShouts).toBe(1);
  });

  it("ranks the top-5 most-requested tracks' artworks", async () => {
    const service = await makeService();

    // a×3, b×2, c×1, d×1 — plus 17 one-off tracks to hit the cap.
    for (let i = 0; i < 3; i++) service.onRequestSubmitted(true, "a", "img://a");
    for (let i = 0; i < 2; i++) service.onRequestSubmitted(true, "b", "img://b");
    service.onRequestSubmitted(true, "c", "img://c");
    service.onRequestSubmitted(true, "d"); // no artwork — excluded from strip
    for (let i = 0; i < 17; i++) {
      service.onRequestSubmitted(true, `x${i}`, `img://x${i}`);
    }
    // Same track re-requested with a new artwork → artwork updates, count grows.
    service.onRequestSubmitted(true, "a", "img://a2");

    const snap = service.getSnapshot();
    expect(snap.topRequests).toEqual([
      "img://a2", // 4 requests
      "img://b", // 2 requests
      "img://x0", "img://x1", "img://x2", // 1 each, insertion order
    ]);
  });

  it("persists to storage and reloads in a fresh instance", async () => {
    const service = await makeService();
    service.onPlaybackStarted();
    service.onAudibleTick(Date.now() + 90_000);
    service.onPlaybackStopped();
    hearTrack(service, "a", true);
    service.onRequestSubmitted(true);
    await service.flushForTesting();

    const reloaded = await makeService();
    const snap = reloaded.getSnapshot();
    expect(snap.totalMs).toBe(90_000);
    expect(snap.totalSessions).toBe(1);
    expect(snap.totalTracks).toBe(1);
    expect(snap.totalRequestTracks).toBe(1);
    expect(snap.totalSubmitted).toBe(1);
  });

  it("computes streaks across consecutive listening days", async () => {
    const service = await makeService();

    // Absolute day anchors (computed before the clock moves).
    const base = dayStart(0);
    const noonOf = (offset: number): number =>
      base + offset * 86_400_000 + 12 * 3_600_000;

    // Three consecutive days of listening.
    for (const offset of [-2, -1, 0]) {
      at(noonOf(offset));
      service.onPlaybackStarted();
      service.onAudibleTick(noonOf(offset) + 60_000);
      service.onPlaybackStopped();
    }
    let snap = service.getSnapshot();
    expect(snap.currentStreak).toBe(3);
    expect(snap.maxStreak).toBe(3);
    expect(snap.activeDays).toBe(3);

    // A listen two days after the last one breaks the current streak.
    at(noonOf(2));
    service.onPlaybackStarted();
    service.onAudibleTick(noonOf(2) + 60_000);
    service.onPlaybackStopped();

    snap = service.getSnapshot();
    expect(snap.currentStreak).toBe(1);
    expect(snap.maxStreak).toBe(3);
  });

  it("discards a corrupt stored blob", async () => {
    memory.set("listenStats", "{not json");
    const service = await makeService();
    expect(service.getSnapshot().totalMs).toBe(0);
  });

  it("keeps daily aggregates forever but compacts old hour detail", async () => {
    const old = dayStart(-200);
    const recent = dayStart(0) + 12 * 3_600_000;

    const first = await makeService();
    at(old + 10 * 3_600_000);
    first.onPlaybackStarted();
    first.onAudibleTick(old + 10 * 3_600_000 + 60_000);
    first.onPlaybackStopped();
    at(recent);
    first.onPlaybackStarted();
    first.onAudibleTick(recent + 60_000);
    first.onPlaybackStopped();
    await first.flushForTesting();

    const reloaded = await makeService();
    const snap = reloaded.getSnapshot();
    expect(snap.totalMs).toBe(120_000); // both days kept
    const oldDay = snap.days[dayKeyOf(old)];
    const recentDay = snap.days[dayKeyOf(recent)];
    expect(oldDay.hours.some((h) => h > 0)).toBe(false); // compacted
    expect(recentDay.hours[12]).toBeGreaterThan(0); // recent detail kept
  });
});

/** A well-formed stored day; overrides let a test break one field at a time. */
const storedDay = (overrides: Record<string, unknown> = {}) => ({
  ms: 60_000,
  sessions: 1,
  tracks: 2,
  requests: 0,
  submitted: 0,
  shouts: 0,
  firstAt: null,
  lastAt: null,
  hours: Array.from({ length: 24 }, (_, i) => (i === 9 ? 60_000 : 0)),
  ...overrides,
});

describe("listenStatsService stored-data sanitizing", () => {
  beforeEach(() => {
    memory.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(dayStart(0) + 12 * 3_600_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops malformed days and keys, and repairs bad numeric fields", async () => {
    const good = dayKeyOf(dayStart(-1));
    const repaired = dayKeyOf(dayStart(-2));
    memory.set(
      "listenStats",
      JSON.stringify({
        version: 1,
        days: {
          [good]: storedDay(),
          // Fixable: junk counters become 0, hours are clamped to 24 slots.
          [repaired]: storedDay({
            ms: -500,
            sessions: "many",
            tracks: -3,
            firstAt: "noon",
            hours: [5, "x", -1, null, ...Array(40).fill(7)],
          }),
          "not-a-day": storedDay(),
          "2024-1-1": storedDay(),
          [dayKeyOf(dayStart(-3))]: null,
          [dayKeyOf(dayStart(-4))]: { ms: "lots", hours: [] },
          [dayKeyOf(dayStart(-5))]: storedDay({ hours: "nope" }),
          [dayKeyOf(dayStart(-6))]: storedDay({ ms: Number.NaN }),
        },
      }),
    );

    const snap = (await makeService()).getSnapshot();

    expect(Object.keys(snap.days).sort()).toEqual([repaired, good].sort());
    expect(snap.days[good].tracks).toBe(2);
    const fixed = snap.days[repaired];
    expect(fixed.ms).toBe(0);
    expect(fixed.sessions).toBe(0);
    expect(fixed.tracks).toBe(0);
    expect(fixed.firstAt).toBeNull();
    expect(fixed.hours).toHaveLength(24);
    expect(fixed.hours.slice(0, 4)).toEqual([5, 0, 0, 0]);
    expect(fixed.hours[23]).toBe(7);
  });

  it("keeps only well-formed top-request entries", async () => {
    memory.set(
      "listenStats",
      JSON.stringify({
        version: 1,
        days: {},
        topRequests: {
          ok: { n: 3.9, art: "img://ok" },
          noArt: { n: 9, art: 42 }, // kept, but has no usable artwork
          zero: { n: 0, art: "img://zero" },
          negative: { n: -1, art: "img://neg" },
          text: { n: "5", art: "img://text" },
          nul: null,
          scalar: 7,
        },
      }),
    );

    const snap = (await makeService()).getSnapshot();

    expect(snap.topRequests).toEqual(["img://ok"]);
  });

  it("floors fractional request counts when ranking", async () => {
    memory.set(
      "listenStats",
      JSON.stringify({
        version: 1,
        days: {},
        topRequests: {
          a: { n: 2.9, art: "img://a" },
          b: { n: 2, art: "img://b" },
          c: { n: 3, art: "img://c" },
        },
      }),
    );

    const service = await makeService();
    // a floors to 2 and ties b; first-seen wins the tie.
    expect(service.getSnapshot().topRequests).toEqual([
      "img://c",
      "img://a",
      "img://b",
    ]);
  });

  it.each([["null"], ['"text"'], ["42"]])(
    "starts fresh when the stored JSON is %s",
    async (raw) => {
      memory.set("listenStats", raw);
      const snap = (await makeService()).getSnapshot();
      expect(snap.totalMs).toBe(0);
      expect(snap.days).toEqual({});
    },
  );

  it("tolerates a blob with missing days/topRequests sections", async () => {
    memory.set("listenStats", JSON.stringify({ version: 1 }));
    const snap = (await makeService()).getSnapshot();
    expect(snap.days).toEqual({});
    expect(snap.topRequests).toEqual([]);
  });

  it("drops the oldest days beyond the 400-day cap", async () => {
    const days: Record<string, unknown> = {};
    const keyOf = (i: number): string =>
      new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
    for (let i = 0; i < 405; i++) days[keyOf(i)] = storedDay({ hours: [] });
    memory.set("listenStats", JSON.stringify({ version: 1, days }));

    const snap = (await makeService()).getSnapshot();

    const keys = Object.keys(snap.days).sort();
    expect(keys).toHaveLength(400);
    expect(keys[0]).toBe(keyOf(5));
    expect(keys[399]).toBe(keyOf(404));
    expect(snap.days[keyOf(0)]).toBeUndefined();
  });
});

describe("listenStatsService streak anchoring", () => {
  beforeEach(() => {
    memory.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(dayStart(0) + 12 * 3_600_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Anchored before any clock move: dayStart() is relative to the moving clock.
  let todayStart = 0;
  beforeEach(() => {
    todayStart = dayStart(0);
  });

  const listenOn = (service: ListenStatsService, offset: number): void => {
    const noon = todayStart + offset * 86_400_000 + 12 * 3_600_000;
    at(noon);
    service.onPlaybackStarted();
    service.onAudibleTick(noon + 60_000);
    service.onPlaybackStopped();
  };

  it("keeps the streak alive when today has not counted yet", async () => {
    const service = await makeService();
    listenOn(service, -2);
    listenOn(service, -1);
    at(todayStart + 12 * 3_600_000); // today, nothing heard yet

    const snap = service.getSnapshot();
    expect(snap.currentStreak).toBe(2);
    expect(snap.maxStreak).toBe(2);
  });

  it("has no current streak once yesterday is also missed", async () => {
    const service = await makeService();
    listenOn(service, -3);
    listenOn(service, -2);
    at(todayStart + 12 * 3_600_000);

    const snap = service.getSnapshot();
    expect(snap.currentStreak).toBe(0);
    expect(snap.maxStreak).toBe(2);
  });
});

describe("listenStatsService persistence scheduling", () => {
  beforeEach(() => {
    memory.clear();
    vi.useFakeTimers();
    vi.setSystemTime(dayStart(0) + 12 * 3_600_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("coalesces a burst of updates into one debounced write", async () => {
    const service = new ListenStatsService();
    await service.initialize();

    service.onShoutSubmitted(true);
    service.onShoutSubmitted(true);
    service.onRequestSubmitted(true);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(memory.get("listenStats") ?? "{}");
    const day = Object.values<{ shouts: number; submitted: number }>(saved.days)[0];
    expect(day.shouts).toBe(2);
    expect(day.submitted).toBe(1);

    // A later change schedules a fresh write.
    service.onShoutSubmitted(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it("writes 1 Hz audible ticks once per 30s instead of every beat", async () => {
    const service = new ListenStatsService();
    await service.initialize();

    const start = Date.now();
    service.onPlaybackStarted();
    for (let i = 1; i <= 29; i++) {
      service.onAudibleTick(start + i * 1_000);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("persists accrued audio promptly when playback stops", async () => {
    const service = new ListenStatsService();
    await service.initialize();

    const start = Date.now();
    service.onPlaybackStarted();
    service.onAudibleTick(start + 1_000);
    service.onAudibleTick(start + 2_000);
    service.onPlaybackStopped();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("lets a discrete event pull a pending slow flush forward", async () => {
    const service = new ListenStatsService();
    await service.initialize();

    const start = Date.now();
    service.onPlaybackStarted();
    service.onAudibleTick(start + 1_000);
    service.onShoutSubmitted(true);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("degrades to memory-only (warns, keeps counting) when a save fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("disk full"));
    const service = new ListenStatsService();
    await service.initialize();

    service.onShoutSubmitted(true);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(warn).toHaveBeenCalledWith(
      "[ListenStats] save failed:",
      expect.any(Error),
    );
    expect(service.getSnapshot().totalShouts).toBe(1);
  });

  it("flushForTesting drops the pending timer and is a no-op when clean", async () => {
    const service = new ListenStatsService();
    await service.initialize();

    await service.flushForTesting(); // nothing dirty yet
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    service.onShoutSubmitted(true);
    await service.flushForTesting();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000); // the debounce timer was cancelled
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("reset wipes stats and storage, and survives a storage failure", async () => {
    const service = new ListenStatsService();
    await service.initialize();
    service.onRequestSubmitted(true, "a", "img://a");
    await service.flushForTesting();
    expect(memory.has("listenStats")).toBe(true);

    await service.reset();
    expect(memory.has("listenStats")).toBe(false);
    const snap = service.getSnapshot();
    expect(snap.totalSubmitted).toBe(0);
    expect(snap.topRequests).toEqual([]);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("io"));
    await expect(service.reset()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("[ListenStats] reset failed:", expect.any(Error));
  });
});
