import { vi } from "vitest";
import type {
  MediaMetadata,
  NowPlayingMetadata as AirwaveNowPlaying,
  PlaybackState,
  PlayerEventMap,
  PlayerStatus,
  Progress,
} from "react-native-anything-player";

/** The slice of an Airwave player the service drives, with event emitters. */
export class FakePlayer {
  status: PlayerStatus = {
    state: "idle",
    playWhenReady: false,
    loadId: 0,
    isLive: false,
    duration: null,
    seekable: false,
    interruption: null,
    error: null,
    reconnect: null,
    network: "online",
    volume: 1,
    muted: false,
    rate: 1,
    route: { kind: "speaker", name: null },
    sleepAt: null,
    qualities: [],
    quality: null,
    selectedQuality: null,
    video: null,
  };
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  load = vi.fn(async (_source: unknown, options?: { autoplay?: boolean }) => {
    this.setState("loading", options?.autoplay ?? false);
    return this.status;
  });
  play = vi.fn(async () => {
    this.setState(this.status.state === "paused" ? "playing" : this.status.state, true);
    return this.status;
  });
  pause = vi.fn(async () => {
    this.setState("paused", false);
    return this.status;
  });
  selectQuality = vi.fn(async (_id: string) => {});
  /** RNAP's sleep timer: `status.sleepAt` follows it; {@link fireSleep} runs it out. */
  sleep = vi.fn(async (timer: { after: number; fadeOut?: number } | null) => {
    this.status = { ...this.status, sleepAt: timer ? Date.now() + timer.after * 1000 : null };
    this.emit("status", this.status);
    return this.status;
  });
  updateNowPlaying = vi.fn(async (_m: AirwaveNowPlaying) => {});
  setAudioSampling = vi.fn(() => true);
  release = vi.fn(async () => {});
  getProgress = vi.fn((): Progress => ({
    position: 0,
    duration: null,
    buffered: 0,
    bufferedAhead: 6,
    liveOffset: null,
    liveOffsetSettled: false,
    programDate: null,
    timestamp: Date.now(),
  }));

  on<E extends keyof PlayerEventMap>(event: E, listener: PlayerEventMap[E]): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (...args: unknown[]) => void);
    this.listeners.set(event, set);
    return () => set.delete(listener as (...args: unknown[]) => void);
  }

  setState(state: PlaybackState, playWhenReady = this.status.playWhenReady): void {
    this.status = { ...this.status, state, playWhenReady };
    this.emit("status", this.status);
  }

  /** The rendition playing (a switch landed, or a load opened it). */
  setQuality(quality: string | null): void {
    this.status = { ...this.status, quality };
    this.emit("status", this.status);
  }

  /** The sleep timer ran out: RNAP pauses, then reports it. */
  fireSleep(): void {
    this.status = { ...this.status, state: "paused", playWhenReady: false, sleepAt: null };
    this.emit("status", this.status);
    this.emit("sleep", { reason: "fired", timestamp: Date.now() });
  }

  /** An ICY title becomes audible. */
  hear(title: string, at = Date.now()): void {
    const metadata: MediaMetadata = { title, raw: { StreamTitle: title }, timestamp: at };
    this.emit("metadata", metadata);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((l) => l(...args));
  }
}

/**
 * RNAP's 1 Hz progress readings for a live stream `lagS` behind live. Like
 * RNAP it settles on the live point (`position + lag − time`): once that has
 * not risen by more than 0.1 s for 3 s, so a stall (position held, lag
 * growing) stays settled; `reset()` is a `discontinuity` (measured again).
 * The media position runs in real time from the first reading unless given.
 */
export function liveReadings() {
  let point = Number.NaN;
  let risenAt = 0;
  let start: number | null = null;
  const read = (lagS: number, position = (Date.now() - (start ??= Date.now())) / 1000): Progress => {
    const next = position + lagS - Date.now() / 1000;
    if (!(next <= point + 0.1)) risenAt = Date.now();
    point = next;
    return {
      position,
      duration: null,
      buffered: 0,
      bufferedAhead: 2,
      liveOffset: lagS,
      liveOffsetSettled: Date.now() - risenAt >= 3_000,
      programDate: null,
      timestamp: Date.now(),
    };
  };
  return Object.assign(read, {
    reset: () => {
      point = Number.NaN;
    },
  });
}
