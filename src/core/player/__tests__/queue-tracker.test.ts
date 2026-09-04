import { describe, expect, it } from "vitest";
import type { Track } from "animu-api";

import {
  QueueTracker,
  normalizePlayEpoch,
  type PendingRequest,
  type QueueObservation,
  type QueueStorage,
} from "../queue-tracker";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Base instant: 2026-09-04 03:40 local (matches the reported bug window). */
const NOW = Date.parse("2026-09-04T03:40:00");

/**
 * Today's LOCAL midnight — mirrors the repository's construction, which
 * date-stamps feed times with local `setHours` (never UTC arithmetic —
 * the two diverge by the device's UTC offset).
 */
const LOCAL_MIDNIGHT = (() => {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

let nextTrackId = 1;

function makeTrack(options: {
  /** Time-of-day the mapper date-stamped with "today" (local ms since midnight). */
  timeOfDayMs: number;
  id?: string;
  isRequest?: boolean;
}): Track {
  const id = options.id ?? String(nextTrackId++);
  return {
    id,
    raw: `Song ${id}`,
    title: `Song ${id}`,
    artist: "Artist",
    anime: "Anime",
    artworks: {},
    artwork: "",
    duration: 200_000,
    isRequest: options.isRequest ?? true,
    startTime: new Date(LOCAL_MIDNIGHT + options.timeOfDayMs),
  };
}

function makePending(options: {
  trackId: string;
  submittedAt: number;
}): PendingRequest {
  return {
    trackId: options.trackId,
    title: `Song ${options.trackId}`,
    submittedAt: options.submittedAt,
  };
}

/** In-memory storage seam for tests. */
function memoryStorage(initial: Record<string, string> = {}): QueueStorage {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

function observe(
  tracker: QueueTracker,
  observation: Partial<QueueObservation> = {},
) {
  return tracker.observe({
    now: NOW,
    onAirTrack: null,
    playedRequests: [],
    ...observation,
  });
}

// ── normalizePlayEpoch (R4 — midnight masquerade) ───────────────────────────

describe("normalizePlayEpoch", () => {
  it("keeps built epochs already in the past (played today)", () => {
    const built = NOW - 5 * 60_000; // 5 minutes ago today
    expect(normalizePlayEpoch(built, NOW)).toBe(built);
  });

  it("shifts future-stamped epochs back a day (played yesterday)", () => {
    // Mapper stamped yesterday's 21:00 play as TODAY 21:00 → future
    const built = NOW - (NOW % DAY_MS) + 21 * 3_600_000;
    const normalized = normalizePlayEpoch(built, NOW);
    expect(normalized).toBe(built - DAY_MS);
    expect(normalized).toBeLessThan(NOW);
  });
});

// ── Pre-submit: no fake queue (the reported bug) ────────────────────────────

describe("pre-submit observations", () => {
  it("never shows played history as queued requests", () => {
    // The reported bug: 6 requests played yesterday evening shown as
    // "6 songs in the queue" the next morning
    const tracker = new QueueTracker(memoryStorage());
    const playedYesterday = [
      makeTrack({ timeOfDayMs: 21 * 3_600_000, id: "25717" }),
      makeTrack({ timeOfDayMs: (20 * 3_600_000 + 58 * 60_000), id: "25549" }),
      makeTrack({ timeOfDayMs: (20 * 3_600_000 + 57 * 60_000), id: "25494" }),
      makeTrack({ timeOfDayMs: (19 * 3_600_000 + 14 * 60_000), id: "25643" }),
      makeTrack({ timeOfDayMs: (19 * 3_600_000 + 14 * 60_000), id: "25520" }),
      makeTrack({ timeOfDayMs: (19 * 3_600_000 + 13 * 60_000), id: "25980" }),
    ];

    const status = observe(tracker, { playedRequests: playedYesterday });

    expect(status.pending).toHaveLength(0);
    expect(status.playedAhead).toBe(0);
    expect(status.playingNow).toBeNull();
  });
});

// ── Played detection (R2) ───────────────────────────────────────────────────

describe("played detection", () => {
  it("consumes the pending entry when the on-air track matches (strict epoch)", async () => {
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 30 * 60_000;
    await tracker.add("42", "Song 42", submittedAt);

    const onAir = makeTrack({ timeOfDayMs: 0, id: "42" });
    (onAir.startTime as Date).setTime(NOW - 60_000); // started 1 min ago

    const status = observe(tracker, { onAirTrack: onAir });

    expect(status.pending).toHaveLength(0);
    expect(status.playingNow?.trackId).toBe("42");
  });

  it("consumes via feed rows matching track id after submission", async () => {
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 2 * 3_600_000;
    await tracker.add("42", "Song 42", submittedAt);

    // Feed shows the song played 1h after submission (today 02:40 → past)
    const feed = [makeTrack({ timeOfDayMs: 2 * 3_600_000, id: "42" })];

    const status = observe(tracker, { playedRequests: feed });

    expect(status.pending).toHaveLength(0);
    expect(status.playingNow?.trackId).toBe("42");
  });

  it("does NOT consume via a play that happened BEFORE the submission", async () => {
    // Someone else requested the same song earlier and it played before
    // mine was submitted — mine is still queued behind
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 30 * 60_000;
    await tracker.add("42", "Song 42", submittedAt);

    const feed = [makeTrack({ timeOfDayMs: 2 * 3_600_000, id: "42" })]; // 02:40 today
    const status = observe(tracker, { playedRequests: feed });

    expect(status.pending).toHaveLength(1);
    expect(status.playingNow).toBeNull();
  });
});

// ── FIFO frontier (R3) ──────────────────────────────────────────────────────

describe("FIFO frontier", () => {
  it("counts distinct plays after the submission as played ahead", async () => {
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 3 * 3_600_000;
    await tracker.add("42", "Song 42", submittedAt);

    // Two other requests played since submission (01:00 and 02:00 today)
    const feed = [
      makeTrack({ timeOfDayMs: 2 * 3_600_000, id: "100" }),
      makeTrack({ timeOfDayMs: 1 * 3_600_000, id: "101" }),
    ];

    const status = observe(tracker, { playedRequests: feed });
    expect(status.playedAhead).toBe(2);

    // Same feed again → no double counting
    const again = observe(tracker, { playedRequests: feed });
    expect(again.playedAhead).toBe(2);
  });

  it("ignores plays older than the submission", async () => {
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 30 * 60_000;
    await tracker.add("42", "Song 42", submittedAt);

    const feed = [makeTrack({ timeOfDayMs: 1 * 3_600_000, id: "100" })]; // 01:00 — before 03:10
    const status = observe(tracker, { playedRequests: feed });

    expect(status.playedAhead).toBe(0);
  });

  it("advances the frontier as new plays appear", async () => {
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 4 * 3_600_000;
    await tracker.add("42", "Song 42", submittedAt);

    observe(tracker, {
      playedRequests: [makeTrack({ timeOfDayMs: 1 * 3_600_000, id: "100" })],
    });

    const later = observe(tracker, {
      playedRequests: [
        makeTrack({ timeOfDayMs: 3 * 3_600_000, id: "102" }), // newest
        makeTrack({ timeOfDayMs: 2 * 3_600_000, id: "101" }),
        makeTrack({ timeOfDayMs: 1 * 3_600_000, id: "100" }),
      ],
    });

    expect(later.playedAhead).toBe(3);
  });

  it("clears once the user's own request plays (wait is over)", async () => {
    const tracker = new QueueTracker(memoryStorage());
    const submittedAt = NOW - 2 * 3_600_000;
    await tracker.add("42", "Song 42", submittedAt);

    observe(tracker, {
      playedRequests: [makeTrack({ timeOfDayMs: 1 * 3_600_000, id: "100" })],
    });

    // Own song plays at 02:30 (30 min ago)
    const final = observe(tracker, {
      playedRequests: [
        makeTrack({ timeOfDayMs: 2.5 * 3_600_000, id: "42" }),
        makeTrack({ timeOfDayMs: 1 * 3_600_000, id: "100" }),
      ],
    });

    expect(final.pending).toHaveLength(0);
    expect(final.playingNow?.trackId).toBe("42");
  });
});

// ── Staleness (R5) ──────────────────────────────────────────────────────────

describe("staleness", () => {
  it("drops entries past the horizon instead of queueing them forever", async () => {
    const tracker = new QueueTracker(memoryStorage(), 6 * 3_600_000);
    await tracker.add("42", "Song 42", NOW - 7 * 3_600_000);
    await tracker.add("43", "Song 43", NOW - 30 * 60_000);

    const status = observe(tracker);

    expect(status.pending.map((entry) => entry.trackId)).toEqual(["43"]);
  });

  it("drops stale entries on load", async () => {
    const storage = memoryStorage({
      pendingMusicRequests: JSON.stringify([
        makePending({ trackId: "42", submittedAt: NOW - 8 * 3_600_000 }),
        makePending({ trackId: "43", submittedAt: NOW - 60_000 }),
      ]),
    });
    const tracker = new QueueTracker(storage, 6 * 3_600_000);
    await tracker.load(NOW);

    expect(tracker.status.pending.map((entry) => entry.trackId)).toEqual([
      "43",
    ]);
  });
});

// ── add() ───────────────────────────────────────────────────────────────────

describe("add", () => {
  it("records a submission and persists it", async () => {
    const storage = memoryStorage();
    const tracker = new QueueTracker(storage);

    await tracker.add("42", "Song 42", NOW);
    expect(tracker.status.pending).toHaveLength(1);

    const raw = await storage.get("pendingMusicRequests");
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  it("keeps the oldest submission for duplicate track ids", async () => {
    const tracker = new QueueTracker(memoryStorage());
    await tracker.add("42", "Song 42", NOW - 60_000);
    await tracker.add("42", "Song 42", NOW);

    const pending = tracker.status.pending;
    expect(pending).toHaveLength(1);
    expect(pending[0].submittedAt).toBe(NOW - 60_000);
  });
});

// ── Cadence hint ────────────────────────────────────────────────────────────

describe("cadence", () => {
  it("estimates the mean gap between consecutive feed plays", () => {
    const tracker = new QueueTracker(memoryStorage());
    // Plays 12 min apart, all before NOW (03:40)
    const status = observe(tracker, {
      playedRequests: [
        makeTrack({ timeOfDayMs: 2.0 * 3_600_000, id: "101" }),
        makeTrack({ timeOfDayMs: 2.2 * 3_600_000, id: "102" }),
        makeTrack({ timeOfDayMs: 2.4 * 3_600_000, id: "103" }),
      ],
    });

    expect(status.cadenceMs).toBe(12 * 60_000); // 12 min mean gap
  });

  it("is null with fewer than two feed plays", () => {
    const tracker = new QueueTracker(memoryStorage());
    const status = observe(tracker, {
      playedRequests: [makeTrack({ timeOfDayMs: 3 * 3_600_000, id: "101" })],
    });

    expect(status.cadenceMs).toBeNull();
  });
});
