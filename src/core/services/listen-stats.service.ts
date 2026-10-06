import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRealTrack, type Track } from "@/core/domain/track";

// ─── Data model ───
//
// One JSON blob in AsyncStorage keyed by local calendar day
// ("YYYY-MM-DD"), so heatmaps, streaks and totals all read the same
// structure the recorder writes. Per-day objects stay compact (numbers
// only), and pruning keeps the blob small enough that the whole history
// lives on the device forever.

/** Hours the per-hour breakdown is kept for each day (0–23). */
export const HOUR_SLOTS = 24;
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
/** Storage key — one JSON blob, versioned for future migrations. */
const STORAGE_KEY = "listenStats";
/** Blob schema version. */
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
  /** Music requests the user submitted (client-side count). */
  submitted: number;
  /** Live shout-outs the user submitted (client-side count). */
  shouts: number;
  /** First audible ms of the day (epoch). */
  firstAt: number | null;
  /** Last audible ms of the day (epoch). */
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

/** Track entries kept for the share-card "top requests" ranking. */
const MAX_TRACKED_REQUESTS = 20;
/** How many top artworks the share card shows. */
export const TOP_REQUESTS_SHOWN = 5;

/** A track's request count + latest artwork (for the share card ranking). */
interface TrackedRequest {
  n: number;
  art: string;
}

interface ListenStatsBlob {
  version: number;
  /** Day key ("YYYY-MM-DD") → that day's data, oldest first. */
  days: Record<string, ListenDay>;
  /** Most-requested tracks, keyed by track id (share card "Top 5"). */
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

/** Local hour (0–23) for an epoch ms. */
const hourOf = (epochMs: number): number => new Date(epochMs).getHours();

/**
 * Splits an epoch range into per-day, per-hour ms buckets. A session that
 * crosses midnight (and hour boundaries) attributes each millisecond to the
 * day/hour it was actually heard in.
 */
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
    // Advance to the next hour boundary (or the end).
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
  /** Total audible listening across all stored days (ms). */
  totalMs: number;
  /** Total counted sessions. */
  totalSessions: number;
  /** Total tracks heard (filler excluded). */
  totalTracks: number;
  /** Total listener-request tracks heard. */
  totalRequestTracks: number;
  /** Total music requests submitted. */
  totalSubmitted: number;
  /** Total live shout-outs submitted. */
  totalShouts: number;
  /** Current consecutive-day listening streak (today counts if ≥ MIN_SESSION_MS). */
  currentStreak: number;
  /** Longest streak in the stored history. */
  maxStreak: number;
  /** Longest single-day listening (ms). */
  bestDayMs: number;
  /** Number of days with any counted listening. */
  activeDays: number;
  /** Epoch ms of the first stored day (0 when empty). */
  firstDayAt: number;
  /** Artwork URLs of the most-requested tracks, most-requested first. */
  topRequests: string[];
}

const parseDayKey = (key: string): number => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
};

/** The day key immediately before `key` (calendar-correct across DST). */
const prevDayKey = (key: string): string => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKeyOf(new Date(y, (m ?? 1) - 1, (d ?? 1) - 1).getTime());
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
    // Keys must look like day keys — anything else is discarded.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const day = sanitizeDay(val);
    if (day) days[key] = day;
  }
  return days;
};

/** One stored top-request entry, or null when malformed. */
const sanitizeTrackedRequest = (value: unknown): TrackedRequest | null => {
  if (typeof value !== "object" || value === null) return null;
  const { n, art } = value as { n?: unknown; art?: unknown };
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  return { n: Math.floor(n), art: typeof art === "string" ? art : "" };
};

const sanitizeTopRequests = (value: unknown): Record<string, TrackedRequest> => {
  const topRequests: Record<string, TrackedRequest> = {};
  if (typeof value !== "object" || value === null) return topRequests;
  for (const [id, val] of Object.entries(value as Record<string, unknown>)) {
    const entry = sanitizeTrackedRequest(val);
    if (entry) topRequests[id] = entry;
  }
  return topRequests;
};

/**
 * Drops the weakest track once the map exceeds the cap (first-seen wins
 * ties, matching insertion order).
 */
const dropWeakestRequest = (top: Record<string, TrackedRequest>): void => {
  const ids = Object.keys(top);
  if (ids.length <= MAX_TRACKED_REQUESTS) return;
  let weakest = ids[0];
  for (const id of ids) {
    if (top[id].n < top[weakest].n) weakest = id;
  }
  delete top[weakest];
};

/** Plain code-unit string order (identical to the default `.sort()`), which is chronological for ISO day keys. */
const compareKeys = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

/**
 * The key a current streak starts from: today, else yesterday (today hasn't
 * counted yet), else none.
 */
const streakStart = (active: Set<string>): string | null => {
  const today = dayKeyOf(Date.now());
  if (active.has(today)) return today;
  const yesterday = dayKeyOf(Date.now() - 86_400_000);
  return active.has(yesterday) ? yesterday : null;
};

/**
 * On-device listen-stats recorder + reader.
 *
 * Recording is event-driven and crash-safe: every change is flushed to
 * AsyncStorage as one JSON blob (best-effort — a failed write degrades to
 * in-memory state, mirroring `recentSearchesService`), and accumulation
 * happens in bounded segments so a killed app can only lose the current
 * segment, never corrupt the file.
 *
 * Playback truth is fed from `PlayerService`:
 * - `onPlaybackStarted()` / `onPlaybackStopped()` — session boundaries and
 *   the segment anchor, driven by the transport state machine;
 * - `onAudibleTick(now)` — one processed heartbeat beat while `playing`,
 *   which closes out one ~1s audible segment (background-safe: native
 *   status events keep the heartbeat beating while the app is hidden);
 * - `onTrackHeard(track, isPlaying)` — a track reached the speaker;
 * - `onRequestSubmitted(success)` / `onShoutSubmitted(success)`.
 */
export class ListenStatsService {
  private blob: ListenStatsBlob = { version: SCHEMA_VERSION, days: {} };
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Dirty flag — coalesces bursts of updates into one write. */
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
        // Corrupt/unreadable — start fresh rather than crash.
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
    let existing = this.blob.days[day];
    if (!existing) {
      existing = EMPTY_DAY();
      this.blob.days[day] = existing;
    }
    return existing;
  }

  /**
   * Best-effort coalesced write; a failure degrades to memory-only. The
   * earliest requested deadline wins, so a discrete event never waits behind
   * the slow audible-tick cadence.
   */
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
      AsyncStorage.setItem(STORAGE_KEY, json).catch((error) => {
        console.warn("[ListenStats] save failed:", error);
      });
    }, delayMs);
  }

  // ── Recording API (called by PlayerService) ──

  /**
   * The transport entered `playing`. Opens the recording window: audible
   * time accrues from here, beat by beat, until playback stops.
   */
  onPlaybackStarted(): void {
    if (!this.loaded) return;
    this.segmentStart = Date.now();
    this.inSession = true;
  }

  /**
   * One processed heartbeat beat while the transport is `playing` — closes
   * out the [anchor, now) segment. The anchor means beats can never
   * over-count a paused gap: a `playing` entry after any non-playing stretch
   * always re-anchors through {@link onPlaybackStarted}.
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
    // Cap pathological gaps (clock jumps, suspended JS): a segment longer
    // than an hour of wall time is clipped — real 1 Hz segments are ~1s.
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
    this.segmentStart = null;
    if (this.inSession) {
      this.inSession = false;
      if (this.currentSessionMs >= MIN_SESSION_MS) {
        const day = dayKeyOf(Date.now());
        this.ensureDay(day).sessions += 1;
      }
      this.currentSessionMs = 0;
      // Audible ticks only schedule slow flushes; persist what accrued now —
      // immediately, not on the 2s event delay: once audio stops, iOS may
      // suspend a backgrounded app within seconds (and later kill it), taking
      // the pending timer and up to 30s of ticks with it.
      this.scheduleFlush(0);
    }
  }

  /** A track reached the speaker while audio was playing. */
  onTrackHeard(track: Track | null, isPlaying: boolean): void {
    if (!this.loaded || !isPlaying || !track) return;
    // Station rule for real programming (jingles / idents / filler
    // transitions are not music — see the package's `isRealTrack`).
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

  /**
   * A music request the user submitted was accepted by the server. Tracks
   * accrue per id (count + latest artwork) so the share card can rank the
   * listener's actual most-requested songs.
   */
  onRequestSubmitted(
    success: boolean,
    trackId?: string,
    artworkUrl?: string,
  ): void {
    if (!this.loaded || !success) return;
    this.ensureDay(dayKeyOf(Date.now())).submitted += 1;
    if (trackId) {
      const top = this.blob.topRequests ?? {};
      const entry = top[trackId] ?? { n: 0, art: "" };
      entry.n += 1;
      if (artworkUrl) entry.art = artworkUrl;
      top[trackId] = entry;
      // Bound the map: drop the least-requested track past the cap.
      dropWeakestRequest(top);
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

  /**
   * Builds a full snapshot. Cheap: the blob is at most a few hundred small
   * day objects, so aggregation is a plain loop.
   */
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
    // Share-card ranking: most-requested tracks' artworks, best first.
    const topRequests = Object.entries(this.blob.topRequests ?? {})
      .filter(([, entry]) => entry.art)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, TOP_REQUESTS_SHOWN)
      .map(([, entry]) => entry.art);
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
    };
  }

  private streaks(keys: string[]): { currentStreak: number; maxStreak: number } {
    const active = new Set(keys.filter((k) => this.blob.days[k].ms >= MIN_SESSION_MS));
    if (active.size === 0) return { currentStreak: 0, maxStreak: 0 };
    // Longest run across the sorted active days.
    let max = 1;
    let run = 1;
    const sorted = [...active].sort(compareKeys);
    for (let i = 1; i < sorted.length; i++) {
      const diff =
        (parseDayKey(sorted[i]) - parseDayKey(sorted[i - 1])) / 86_400_000;
      // A missing day breaks the streak; DST offsets never reach a full day.
      run = diff > 0 && diff < 2 ? run + 1 : 1;
      if (run > max) max = run;
    }
    // Current streak: walk back from today (or yesterday, if today hasn't
    // counted yet). Day steps go through calendar dates, not raw 24h
    // subtraction, so DST shifts can't loop or skip a day.
    let cursor = streakStart(active);
    let current = 0;
    while (cursor != null && active.has(cursor)) {
      current += 1;
      cursor = prevDayKey(cursor);
    }
    return { currentStreak: current, maxStreak: max };
  }

  /**
   * Drops per-hour detail past the detail window and whole days past the
   * hard cap. Aggregate stats (minutes, sessions, tracks) are kept forever —
   * the hour breakdown is the only thing that ages out.
   */
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

  /** Test hook — flush any pending write immediately. */
  async flushForTesting(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.blob));
  }

  /** Clears all stats (destructive — used by a future reset action). */
  async reset(): Promise<void> {
    this.blob = { version: SCHEMA_VERSION, days: {}, topRequests: {} };
    this.segmentStart = null;
    this.currentSessionMs = 0;
    this.inSession = false;
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
