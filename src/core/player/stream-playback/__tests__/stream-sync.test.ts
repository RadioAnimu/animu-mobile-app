import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/domain/track";
import {
  getSyncedTrackProgress,
  StreamSyncEngine,
} from "@/core/player/stream-playback/stream-sync";

const makeTrack = (overrides: Partial<Track> = {}): Track =>
  ({
    startTime: new Date(Date.now() - 5_000),
    duration: 60_000,
    ...overrides,
  }) as Track;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StreamSyncEngine", () => {
  it("falls back to the device clock before any measurement", () => {
    const engine = new StreamSyncEngine();

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.now()).toBe(Date.now());
    expect(engine.delay).toBe(0);
  });

  it("shifts now back by the measured live offset", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 7.5 });

    expect(engine.hasMeasurement).toBe(true);
    expect(engine.now()).toBe(Date.now() - 7_500);
  });

  it("keeps the last known offset while a reading is missing", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 4 });
    engine.updateFromStatus({ isLive: true, offsetFromLive: null });

    expect(engine.delay).toBe(4_000);
    expect(engine.now()).toBe(Date.now() - 4_000);
  });

  it("ignores negative/non-finite offsets", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 4 });
    engine.updateFromStatus({ isLive: true, offsetFromLive: -1 });
    engine.updateFromStatus({ isLive: true, offsetFromLive: Number.NaN });

    expect(engine.delay).toBe(4_000);
  });

  it("clears the delay after sustained non-live frames", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 4 });

    // A single frame is a teardown transient (held); sustained non-live is a
    // genuinely non-broadcast source and clears the estimate.
    for (let i = 0; i < 5; i++) {
      engine.updateFromStatus({ isLive: false, offsetFromLive: null });
    }

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.now()).toBe(Date.now());
  });

  it("trusts a finite offset even when the live flag is false", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: false, offsetFromLive: 6 });

    expect(engine.now()).toBe(Date.now() - 6_000);
  });

  it("falls back to the forward buffer when the live offset is unavailable", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({
      isLive: true,
      offsetFromLive: null,
      bufferedAheadSeconds: 8,
    });

    expect(engine.now()).toBe(Date.now() - 8_000);
  });

  it("prefers the live offset over the forward buffer", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({
      isLive: true,
      offsetFromLive: 4,
      bufferedAheadSeconds: 8,
    });

    expect(engine.delay).toBe(4_000);
  });

  it("tracks a rising lag in bounded steps and snaps large jumps", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5 }); // snaps (first)

    engine.updateFromStatus({ isLive: true, offsetFromLive: 5.3 }); // +300ms rise
    expect(engine.delay).toBe(5_300);

    engine.updateFromStatus({ isLive: true, offsetFromLive: 10 }); // snaps
    expect(engine.delay).toBe(10_000);
  });

  it("caps a single rising step so a spike cannot fling the estimate", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 1 });

    // +2s rise, below the re-lock threshold → one bounded step.
    engine.updateFromStatus({ isLive: true, offsetFromLive: 3 });
    expect(engine.delay).toBe(2_000);
  });

  it("eases a falling lag instead of jumping forward", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });

    engine.updateFromStatus({ isLive: true, offsetFromLive: 3 });
    // 5000 * 0.85 + 3000 * 0.15 = 4700
    expect(engine.delay).toBeCloseTo(4_700, 5);
  });

  it("clamps implausible offsets", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 9_999 });

    expect(engine.delay).toBe(60_000);
  });

  it("re-locks on the next reading after an SSE arrival anchor", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });

    engine.updateFromAnchor({ startTimeMs: Date.now(), receivedAtMs: Date.now() });
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5.2 }); // snaps

    expect(engine.delay).toBe(5_200);
    expect(engine.lastAnchor).not.toBeNull();
  });

  it("applies a gross server-clock correction to now()", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 0 });
    // Device is 60s ahead of the server → station time is 60s behind it.
    engine.setClockSkew(-60_000);

    expect(engine.clockSkew).toBe(-60_000);
    expect(engine.now()).toBe(Date.now() - 60_000);
  });

  it("ignores sub-threshold clock skew (date header resolution)", () => {
    const engine = new StreamSyncEngine();
    engine.setClockSkew(800);

    expect(engine.clockSkew).toBe(0);
    expect(engine.now()).toBe(Date.now());
  });

  it("corrects the fallback clock before any lag measurement", () => {
    const engine = new StreamSyncEngine();
    engine.setClockSkew(-60_000);

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.now()).toBe(Date.now() - 60_000);
  });

  it("keeps the clock correction across reset()", () => {
    const engine = new StreamSyncEngine();
    engine.setClockSkew(-60_000);
    engine.reset();

    expect(engine.clockSkew).toBe(-60_000);
  });

  it("keeps the lag through a brief isLive:false teardown gap", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 4 });

    // An item swap (`replace()`) emits a few teardown frames at ~1 Hz; the
    // estimate must survive them or the UI flings to the live point.
    for (let i = 0; i < 4; i++) {
      engine.updateFromStatus({ isLive: false, offsetFromLive: null, bufferedAheadSeconds: null });
    }
    expect(engine.delay).toBe(4_000);
    expect(engine.hasMeasurement).toBe(true);

    // Sustained non-live → genuinely not a broadcast.
    engine.updateFromStatus({ isLive: false, offsetFromLive: null, bufferedAheadSeconds: null });
    expect(engine.delay).toBe(0);
    expect(engine.hasMeasurement).toBe(false);
  });

  it("reset() drops the estimate", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });
    engine.updateFromAnchor({ startTimeMs: 1, receivedAtMs: 2 });

    engine.reset();

    expect(engine.hasMeasurement).toBe(false);
    expect(engine.now()).toBe(Date.now());
    expect(engine.lastAnchor).toBeNull();
  });

  it("holds the estimate through an unmeasurable burst (bad link)", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });
    vi.setSystemTime(new Date(Date.now() + 4_000));
    expect(engine.settled).toBe(true);

    // Packet loss / a stalled buffer: no offset and no buffer for a stretch.
    for (let i = 0; i < 30; i++) {
      engine.updateFromStatus({
        isLive: true,
        offsetFromLive: null,
        bufferedAheadSeconds: null,
      });
    }

    expect(engine.delay).toBe(5_000);
    expect(engine.hasMeasurement).toBe(true);
    expect(engine.settled).toBe(true);
  });

  it("re-measures and re-settles after a sustained non-live clear", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });
    vi.setSystemTime(new Date(Date.now() + 4_000));
    expect(engine.settled).toBe(true);

    // A real source swap (not a teardown blip) discards the estimate.
    for (let i = 0; i < 5; i++) {
      engine.updateFromStatus({ isLive: false, offsetFromLive: null });
    }
    expect(engine.hasMeasurement).toBe(false);
    expect(engine.settled).toBe(false);

    // The live source returns (reconnect): measure again, then settle.
    engine.updateFromStatus({ isLive: true, offsetFromLive: 3 });
    expect(engine.hasMeasurement).toBe(true);
    expect(engine.settled).toBe(false);

    vi.setSystemTime(new Date(Date.now() + 2_600));
    expect(engine.settled).toBe(true);
  });

  it("reports audibility of a track start", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 3 });

    expect(engine.isAudible(Date.now())).toBe(false);
    expect(engine.isAudible(Date.now() - 4_000)).toBe(true);
  });

  describe("settled", () => {
    it("is false on the first reading and until the estimate stops moving", () => {
      const engine = new StreamSyncEngine();
      engine.updateFromStatus({ isLive: true, offsetFromLive: 2 });

      expect(engine.hasMeasurement).toBe(true);
      expect(engine.settled).toBe(false); // minimum quiet period

      vi.setSystemTime(new Date(Date.now() + 2_600));
      expect(engine.settled).toBe(true);
    });

    it("stays settled across a later drift (no flapping)", () => {
      const engine = new StreamSyncEngine();
      engine.updateFromStatus({ isLive: true, offsetFromLive: 2 });
      vi.setSystemTime(new Date(Date.now() + 4_000));
      expect(engine.settled).toBe(true);

      // A later snap/ease — the re-lock a track change arms — must NOT flip
      // the UI back to "calculating".
      engine.updateFromStatus({ isLive: true, offsetFromLive: 9 });
      expect(engine.settled).toBe(true);
    });

    it("caps the wait so a noisy estimate cannot pulse forever", () => {
      const engine = new StreamSyncEngine();
      engine.updateFromStatus({ isLive: true, offsetFromLive: 2 });

      for (let i = 1; i <= 15; i++) {
        vi.setSystemTime(new Date(Date.now() + 1_000));
        engine.updateFromStatus({ isLive: true, offsetFromLive: 2 + i * 0.5 });
      }

      expect(engine.settled).toBe(true);
    });

    it("is false again after reset()", () => {
      const engine = new StreamSyncEngine();
      engine.updateFromStatus({ isLive: true, offsetFromLive: 2 });
      vi.setSystemTime(new Date(Date.now() + 4_000));
      expect(engine.settled).toBe(true);

      engine.reset();
      expect(engine.settled).toBe(false);
    });
  });

  describe("isStale", () => {
    it("reports the age of the retained estimate", () => {
      const engine = new StreamSyncEngine();

      // Never measured → not "stale", just unmeasured.
      expect(engine.isStale(10_000)).toBe(false);

      engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });
      expect(engine.isStale(10_000)).toBe(false);

      vi.setSystemTime(new Date(Date.now() + 11_000));
      expect(engine.isStale(10_000)).toBe(true);

      // A fresh reading resets the age.
      engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });
      expect(engine.isStale(10_000)).toBe(false);
    });

    it("is not stale after reset() (unmeasured, not old)", () => {
      const engine = new StreamSyncEngine();
      engine.updateFromStatus({ isLive: true, offsetFromLive: 5 });
      vi.setSystemTime(new Date(Date.now() + 60_000));

      engine.reset();
      expect(engine.isStale(10_000)).toBe(false);
    });
  });
});

describe("getSyncedTrackProgress", () => {
  it("returns elapsed once the track is audible", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 0 });
    const track = makeTrack();

    expect(getSyncedTrackProgress(track, engine.now())).toEqual({
      elapsedMs: 5_000,
      pending: false,
    });
  });

  it("flags a track that has not reached the speaker yet", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 10 });
    const track = makeTrack({ startTime: new Date(Date.now() - 2_000) });

    // Audible clock is 10s behind → the 2s-old track has not started.
    expect(getSyncedTrackProgress(track, engine.now())).toEqual({
      elapsedMs: null,
      pending: true,
    });
  });

  it("returns ended (not pending) once elapsed passes the duration", () => {
    const engine = new StreamSyncEngine();
    engine.updateFromStatus({ isLive: true, offsetFromLive: 0 });
    const track = makeTrack({
      startTime: new Date(Date.now() - 999_999),
      duration: 1_000,
    });

    expect(getSyncedTrackProgress(track, engine.now())).toEqual({
      elapsedMs: null,
      pending: false,
    });
  });

  it("is empty without a track", () => {
    expect(getSyncedTrackProgress(null, Date.now())).toEqual({
      elapsedMs: null,
      pending: false,
    });
  });
});
