import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRealTrack, type Track } from "@/core/domain/track";

// ─── Data model: one JSON blob, keyed by local calendar day ("YYYY-MM-DD") ───

const HOUR_SLOTS = 24;
/** Per-hour raw data is compacted after this many days (daily totals kept). */
const HOUR_DETAIL_DAYS = 120;
/** Hard cap on stored days — older days are dropped entirely. */
const MAX_DAYS = 400;
/** A play session counts only past this much accumulated audio (Spotify's 30s rule). */
export const MIN_SESSION_MS = 30_000;

/** Write delay after a discrete event (track heard, request, stop). */
const FLUSH_EVENT_MS = 2_000;
/**
 * Write delay when only 1 Hz audible ticks are pending. A process kill loses
 * at most this much listening time; stop/pause flush promptly regardless.
 */
const FLUSH_AUDIBLE_MS = 30_000;
const STORAGE_KEY = "listenStats";
const SCHEMA_VERSION = 1;

/** One local day of listening. All durations are milliseconds. */
export interface ListenDay {
  /** Audible listening time. */
  ms: number;
  /** Number of counted sessions (≥ MIN_SESSION_MS each). */
  sessions: number;
  /** Distinct tracks heard while playing (filler transitions excluded). */
  tracks: number;
  /** Tracks heard that were listener requests. */
  requests: number;
  /** Music requests and live shout-outs the user submitted (client-side counts). */
  submitted: number;
  shouts: number;
  /** First and last audible ms of the day (epoch). */
  firstAt: number | null;
  lastAt: number | null;
  /** Listening ms per local hour of day (0–23). Compacted to all-zero after a while. */
  hours: number[];
}

const emptyHours = (): number[] =>
  Array.from({ length: HOUR_SLOTS }, () => 0);

const EMPTY_DAY = (): ListenDay => ({
  ms: 0,
  sessions: 0,
  tracks: 0,
  requests: 0,
  submitted: 0,
  shouts: 0,
  firstAt: null,
  lastAt: null,
  hours: emptyHours(),
});

const MAX_TRACKED_REQUESTS = 50;
const TOP_REQUESTS_SHOWN = 10;

/** A requested song's count and latest metadata: requests, not songs heard, show a listener's taste. */
interface TrackedRequest {
  n: number;
  title: string;
  artist: string;
  anime: string;
  art: string;
}

/** What the request screen knows about the song being requested. */
export interface RequestedSong {
  title: string;
  artist: string;
  anime: string;
  artwork: string;
}

interface RankedRequest {
  /** `""` for requests recorded before titles were stored. */
  title: string;
  artist: string;
  anime: string;
  /** Artwork URL, `""` when none. */
  art: string;
  requests: number;
}
interface ListenStatsBlob {
  version: number;
  /** Day key ("YYYY-MM-DD") → that day's data, oldest first. */
  days: Record<string, ListenDay>;
  /** Most-requested tracks, keyed by track id. */
  topRequests?: Record<string, TrackedRequest>;
}

// ─── Day-key helpers (local calendar) ───

/** Local calendar day key for an epoch ms: "YYYY-MM-DD". */
export const dayKeyOf = (epochMs: number): string => {
  const d = new Date(epochMs);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const hourOf = (epochMs: number): number => new Date(epochMs).getHours();

/** Splits an epoch range into per-day, per-hour ms buckets (across midnight too). */
export const splitByHour = (
  startMs: number,
  endMs: number,
): { day: string; hour: number; ms: number }[] => {
  const buckets: { day: string; hour: number; ms: number }[] = [];
  if (endMs <= startMs || !Number.isFinite(endMs) || !Number.isFinite(startMs)) return buckets;
  let cursor = startMs;
  while (cursor < endMs) {
    const day = dayKeyOf(cursor);
    const hour = hourOf(cursor);
    const boundary = new Date(cursor);
    boundary.setMinutes(0, 0, 0);
    boundary.setHours(hour + 1);
    const next = Math.min(boundary.getTime(), endMs);
    if (next > cursor) buckets.push({ day, hour, ms: next - cursor });
    cursor = next;
  }
  return buckets;
};

// ─── Service ───

export interface ListenStatsSnapshot {
  days: Record<string, ListenDay>;
  /** Totals across all stored days (see {@link ListenDay}). */
  totalMs: number;
  totalSessions: number;
  totalTracks: number;
  totalRequestTracks: number;
  totalSubmitted: number;
  totalShouts: number;
  /** Current consecutive-day listening streak (today counts if ≥ MIN_SESSION_MS). */
  currentStreak: number;
  maxStreak: number;
  bestDayMs: number;
  activeDays: number;
  /** Epoch ms of the first stored day (0 when empty). */
  firstDayAt: number;
  /** Most-requested songs, most requests first (ties: first requested first). */
  topRequests: RankedRequest[];
  /** Local day key the snapshot was taken on — "today" for its readers. */
  todayKey: string;
}

const parseDayKey = (key: string): number => {
  const [y, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** The day key immediately before `key` (calendar-correct across DST). */
const prevDayKey = (key: string): string => {
  const [y, m = 1, d = 1] = key.split("-").map(Number);
  return dayKeyOf(new Date(y, m - 1, d - 1).getTime());
};

const sanitizeDay = (value: unknown): ListenDay | null => {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<ListenDay>;
  if (
    typeof raw.ms !== "number" ||
    !Number.isFinite(raw.ms) ||
    !Array.isArray(raw.hours)
  ) {
    return null;
  }
  const hours = emptyHours();
  for (let i = 0; i < Math.min(HOUR_SLOTS, raw.hours.length); i++) {
    const h = raw.hours[i];
    if (typeof h === "number" && Number.isFinite(h) && h > 0) hours[i] = h;
  }
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  return {
    ms: Math.max(0, raw.ms),
    sessions: num(raw.sessions),
    tracks: num(raw.tracks),
    requests: num(raw.requests),
    submitted: num(raw.submitted),
    shouts: num(raw.shouts),
    firstAt: typeof raw.firstAt === "number" ? raw.firstAt : null,
    lastAt: typeof raw.lastAt === "number" ? raw.lastAt : null,
    hours,
  };
};

/** Keeps only day-key-shaped entries that survive {@link sanitizeDay}. */
const sanitizeDays = (value: unknown): Record<string, ListenDay> => {
  const days: Record<string, ListenDay> = {};
  if (typeof value !== "object" || value === null) return days;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const day = sanitizeDay(val);
    if (day) days[key] = day;
  }
  return days;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** A positive play/request count floored to an integer, or null. */
const count = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.floor(v) : null;

/** Keeps the well-formed entries of a stored ranking map. */
const sanitizeMap = <T>(
  value: unknown,
  entry: (raw: Record<string, unknown>, n: number) => T,
): Record<string, T> => {
  const out: Record<string, T> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val !== "object" || val === null) continue;
    const raw = val as Record<string, unknown>;
    const n = count(raw.n);
    if (n != null) out[key] = entry(raw, n);
  }
  return out;
};

/** Stored requests (entries from before metadata was kept get `""` fields). */
const sanitizeTopRequests = (value: unknown): Record<string, TrackedRequest> =>
  sanitizeMap(value, (raw, n) => ({
    n,
    title: str(raw.title),
    artist: str(raw.artist),
    anime: str(raw.anime),
    art: str(raw.art),
  }));

/** Entries of a ranking map, most plays first (stable: first-seen wins ties). */
const ranked = <T extends { n: number }>(
  map: Record<string, T> | undefined,
): [string, T][] =>
  Object.entries(map ?? {}).sort((a, b) => b[1].n - a[1].n);

/** Drops the weakest entry once a ranking map exceeds `cap` (the first seen survives a tie). */
const dropWeakest = (top: Record<string, { n: number }>, cap: number): void => {
  const ids = Object.keys(top);
  if (ids.length <= cap) return;
  let weakest = ids[0];
  for (const id of ids) {
    if (top[id].n < top[weakest].n) weakest = id;
  }
  delete top[weakest];
};

/** Code-unit order: chronological for day keys. */
const compareKeys = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

/** Where a current streak starts: today, else yesterday (today not counted yet), else none. */
const streakStart = (active: Set<string>): string | null => {
  const today = dayKeyOf(Date.now());
  if (active.has(today)) return today;
  const yesterday = prevDayKey(today);
  return active.has(yesterday) ? yesterday : null;
};

/**
 * On-device listen stats, recorded from `PlayerService` events. Time accrues
 * in short segments, so a killed app loses only the open one; a failed write
 * degrades to memory.
 */
export class ListenStatsService {
  private blob: ListenStatsBlob = { version: SCHEMA_VERSION, days: {} };
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private flushDeadline = 0;

  // Recording state (not persisted; a crash loses at most the open segment)
  private segmentStart: number | null = null;
  private currentSessionMs = 0;
  private inSession = false;
  /** De-dupes track-heard events for the same audible track. */
  private lastTrackKey: string | null = null;
  private lastTrackHeardAt = 0;

  /** Loads stored stats once. Safe to call repeatedly. */
  initialize(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          this.blob = this.sanitizeBlob(parsed);
        }
      } catch {
        // Corrupt: start fresh rather than crash.
        this.blob = { version: SCHEMA_VERSION, days: {} };
      }
      this.loaded = true;
      this.prune();
    })();
    return this.loadPromise;
  }

  private sanitizeBlob(value: unknown): ListenStatsBlob {
    if (typeof value !== "object" || value === null) {
      return { version: SCHEMA_VERSION, days: {} };
    }
    const raw = value as { days?: unknown; topRequests?: unknown };
    return {
      version: SCHEMA_VERSION,
      days: sanitizeDays(raw.days),
      topRequests: sanitizeTopRequests(raw.topRequests),
    };
  }

  private ensureDay(day: string): ListenDay {
    let existing = this.blob.days[day] as ListenDay | undefined;
    if (!existing) {
      existing = EMPTY_DAY();
      this.blob.days[day] = existing;
    }
    return existing;
  }

  /** Coalesced write; the earliest deadline wins, so an event never waits behind the tick cadence. */
  private scheduleFlush(delayMs: number = FLUSH_EVENT_MS): void {
    this.dirty = true;
    const deadline = Date.now() + delayMs;
    if (this.flushTimer) {
      if (deadline >= this.flushDeadline) return;
      clearTimeout(this.flushTimer);
    }
    this.flushDeadline = deadline;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      const json = JSON.stringify(this.blob);
      AsyncStorage.setItem(STORAGE_KEY, json).catch((error: unknown) => {
        console.warn("[ListenStats] save failed:", error);
      });
    }, delayMs);
  }

  // ── Recording API (called by PlayerService) ──

  /** The transport entered `playing`: audible time accrues from here. */
  onPlaybackStarted(): void {
    if (!this.loaded) return;
    this.segmentStart = Date.now();
    this.inSession = true;
  }

  /**
   * A tick while `playing`: closes the [anchor, now) segment. A paused gap is
   * never counted, since every `playing` entry re-anchors.
   */
  onAudibleTick(nowMs: number): void {
    const start = this.segmentStart;
    this.segmentStart = nowMs;
    if (start == null) return;
    this.addAudibleMs(start, nowMs);
  }

  /** Attributes [startMs, endMs) of audible audio to days/hours. */
  private addAudibleMs(startMs: number, endMs: number): void {
    if (!this.loaded) return;
    if (endMs <= startMs || !Number.isFinite(endMs) || !Number.isFinite(startMs)) return;
    // Over an hour is a clock jump or suspended JS, not listening.
    if (endMs - startMs > 3_600_000) return;
    this.currentSessionMs += endMs - startMs;
    for (const { day, hour, ms } of splitByHour(startMs, endMs)) {
      const d = this.ensureDay(day);
      d.ms += ms;
      d.hours[hour] += ms;
      const now = endMs;
      if (d.firstAt == null || now < d.firstAt) d.firstAt = now;
      if (d.lastAt == null || now > d.lastAt) d.lastAt = now;
    }
    this.scheduleFlush(FLUSH_AUDIBLE_MS);
  }

  /** The transport left `playing` (pause, loss, teardown). Closes the session. */
  onPlaybackStopped(): void {
    if (!this.loaded) return;
    // Close the open segment before dropping the anchor, or a pause would
    // lose everything heard since the last tick (addAudibleMs drops
    // clock-jump outliers and end<=start ranges).
    const start = this.segmentStart;
    this.segmentStart = null;
    if (start != null) this.addAudibleMs(start, Date.now());
    if (this.inSession) {
      this.inSession = false;
      if (this.currentSessionMs >= MIN_SESSION_MS) {
        const day = dayKeyOf(Date.now());
        this.ensureDay(day).sessions += 1;
      }
      this.currentSessionMs = 0;
      // Write now: once audio stops, iOS may suspend a hidden app within
      // seconds, taking the pending write with it.
      this.scheduleFlush(0);
    }
  }

  /** A track reached the speaker while audio was playing. */
  onTrackHeard(track: Track | null, isPlaying: boolean): void {
    if (!this.loaded || !isPlaying || !track) return;
    if (!isRealTrack(track)) return;
    // De-dupe: the same track can be re-announced (poll + SSE race).
    const key = `${track.id}|${track.raw}`;
    const now = Date.now();
    if (key === this.lastTrackKey && now - this.lastTrackHeardAt < 60_000) {
      return;
    }
    this.lastTrackKey = key;
    this.lastTrackHeardAt = now;
    const day = dayKeyOf(now);
    const d = this.ensureDay(day);
    d.tracks += 1;
    if (track.isRequest) d.requests += 1;
    this.scheduleFlush();
  }

  /** A music request the server accepted; counted per track id for the ranking. */
  onRequestSubmitted(
    success: boolean,
    trackId?: string,
    song?: RequestedSong,
  ): void {
    if (!this.loaded || !success) return;
    this.ensureDay(dayKeyOf(Date.now())).submitted += 1;
    if (trackId) {
      const top = this.blob.topRequests ?? {};
      const entry = top[trackId] ?? {
        n: 0,
        title: "",
        artist: "",
        anime: "",
        art: "",
      };
      entry.n += 1;
      // Latest metadata wins — the catalogue fixes typos and swaps covers.
      if (song) {
        entry.title = song.title;
        entry.artist = song.artist;
        entry.anime = song.anime;
        if (song.artwork) entry.art = song.artwork;
      }
      top[trackId] = entry;
      dropWeakest(top, MAX_TRACKED_REQUESTS);
      this.blob.topRequests = top;
    }
    this.scheduleFlush();
  }

  /** A live shout-out the user submitted was accepted by the server. */
  onShoutSubmitted(success: boolean): void {
    if (!this.loaded || !success) return;
    this.ensureDay(dayKeyOf(Date.now())).shouts += 1;
    this.scheduleFlush();
  }

  // ── Queries ──

  /** A full snapshot (a plain loop over at most a few hundred days). */
  getSnapshot(): ListenStatsSnapshot {
    this.prune();
    const keys = Object.keys(this.blob.days).sort(compareKeys);
    let totalMs = 0;
    let totalSessions = 0;
    let totalTracks = 0;
    let totalRequestTracks = 0;
    let totalSubmitted = 0;
    let totalShouts = 0;
    let bestDayMs = 0;
    let firstDayAt = 0;
    for (const key of keys) {
      const d = this.blob.days[key];
      totalMs += d.ms;
      totalSessions += d.sessions;
      totalTracks += d.tracks;
      totalRequestTracks += d.requests;
      totalSubmitted += d.submitted;
      totalShouts += d.shouts;
      if (d.ms > bestDayMs) bestDayMs = d.ms;
      const at = parseDayKey(key);
      if (firstDayAt === 0 || at < firstDayAt) firstDayAt = at;
    }
    const { currentStreak, maxStreak } = this.streaks(keys);
    const topRequests = ranked(this.blob.topRequests)
      .slice(0, TOP_REQUESTS_SHOWN)
      .map(([, r]) => ({
        title: r.title,
        artist: r.artist,
        anime: r.anime,
        art: r.art,
        requests: r.n,
      }));
    return {
      days: this.blob.days,
      totalMs,
      totalSessions,
      totalTracks,
      totalRequestTracks,
      totalSubmitted,
      totalShouts,
      currentStreak,
      maxStreak,
      bestDayMs,
      activeDays: keys.filter((k) => this.blob.days[k].ms > 0).length,
      firstDayAt,
      topRequests,
      todayKey: dayKeyOf(Date.now()),
    };
  }

  private streaks(keys: string[]): { currentStreak: number; maxStreak: number } {
    const active = new Set(keys.filter((k) => this.blob.days[k].ms >= MIN_SESSION_MS));
    if (active.size === 0) return { currentStreak: 0, maxStreak: 0 };
    let max = 1;
    let run = 1;
    const sorted = [...active].sort(compareKeys);
    // Calendar steps, not 24 h spans: a DST day is 23 or 25 hours long.
    for (let i = 1; i < sorted.length; i++) {
      run = prevDayKey(sorted[i]) === sorted[i - 1] ? run + 1 : 1;
      if (run > max) max = run;
    }
    let cursor = streakStart(active);
    let current = 0;
    while (cursor != null && active.has(cursor)) {
      current += 1;
      cursor = prevDayKey(cursor);
    }
    return { currentStreak: current, maxStreak: max };
  }

  /** Drops per-hour detail past the detail window and whole days past the cap. */
  private prune(): void {
    const keys = Object.keys(this.blob.days).sort(compareKeys);
    if (keys.length > MAX_DAYS) {
      for (const key of keys.slice(0, keys.length - MAX_DAYS)) {
        delete this.blob.days[key];
      }
    }
    const cutoff = dayKeyOf(Date.now() - HOUR_DETAIL_DAYS * 86_400_000);
    for (const [key, d] of Object.entries(this.blob.days)) {
      if (key < cutoff && d.hours.some((h) => h > 0)) {
        d.hours = emptyHours();
      }
    }
  }

  /**
   * Clears all stats (the Stats screen's reset). Playing through it keeps
   * recording: the open session restarts from now, and its time counts.
   */
  async reset(): Promise<void> {
    this.blob = {
      version: SCHEMA_VERSION,
      days: {},
      topRequests: {},
    };
    if (this.segmentStart != null) this.segmentStart = Date.now();
    this.currentSessionMs = 0;
    this.lastTrackKey = null;
    this.lastTrackHeardAt = 0;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("[ListenStats] reset failed:", error);
    }
  }
}

export const listenStatsService = new ListenStatsService();
