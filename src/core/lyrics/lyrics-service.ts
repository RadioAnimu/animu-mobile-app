import { isRealTrack } from "../domain/track";
import type { Track } from "../domain/track";
import {
  parseLrc,
  prepareKaraoke,
} from "./lrc-parser";
import { pickBest } from "./matcher";
import { detectLanguage } from "./romaji";
import { lyricsStore } from "./lyrics-store";
import { normalizeText } from "./text";
import type {
  CachedLyrics,
  LyricsFetchOutcome,
  LyricsSnapshot,
  LyricCandidate,
  MatchedMeta,
  TrackFingerprint,
} from "./types";

// ─── Lyrics orchestration ───
//
// One consumer-facing flow: a track comes on air, the service resolves
// its lyrics (memory cache → disk cache → provider), validates the match
// against the full station fingerprint, and emits a snapshot. Failed
// lookups cool down so the 5s poll cadence never re-hammers the provider,
// and every emit is guarded against a track change that landed mid-flight.

export interface LyricsStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface LrcLibApi {
  search(params: {
    trackName?: string;
    artistName?: string;
    q?: string;
  }): Promise<LyricCandidate[]>;
  getExact(params: {
    trackName: string;
    artistName: string;
    durationSec?: number;
  }): Promise<LyricCandidate | null>;
}

export const STORAGE_KEY = "animu.lyrics.cache.v1";
const MAX_CACHE_ENTRIES = 60;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 90 * 1000;

type FailureKind = "not-found" | "error";

export class LyricsService {
  private readonly api: LrcLibApi;
  private readonly storage: LyricsStorage | null;

  private cache = new Map<string, { savedAt: number; lyrics: CachedLyrics }>();
  private storageLoad: Promise<void> | null = null;
  private currentKey: string | null = null;
  private currentFingerprint: TrackFingerprint | null = null;
  private inFlightKey: string | null = null;
  private failures = new Map<string, { at: number; kind: FailureKind }>();

  constructor(deps: { api: LrcLibApi; storage?: LyricsStorage | null }) {
    this.api = deps.api;
    this.storage = deps.storage ?? null;
  }

  /** Stable identity of a track for cache/matching purposes. */
  keyFor(track: Track): string {
    return [
      normalizeText(track.title),
      normalizeText(track.artist),
      Math.round(track.duration || 0),
    ].join("|");
  }

  /** Called on every now-playing emit; only acts when the song changed. */
  async syncTrack(track: Track | null | undefined): Promise<void> {
    if (!track || !isRealTrack(track)) {
      this.reset();
      return;
    }

    const key = this.keyFor(track);
    if (key === this.currentKey) return;
    this.currentKey = key;
    this.currentFingerprint = this.fingerprintOf(track);

    const cached = await this.loadCached(key);
    if (key !== this.currentKey) return;
    if (cached) {
      this.emit(cached);
      return;
    }

    const failure = this.failures.get(key);
    if (failure && Date.now() - failure.at < FAILURE_COOLDOWN_MS) {
      this.emitStatus(failure.kind, key);
      return;
    }

    await this.resolve(key);
  }

  /** User-triggered retry after a not-found/error — bypasses the cooldown. */
  async retry(): Promise<void> {
    if (!this.currentKey || !this.currentFingerprint) return;
    this.failures.delete(this.currentKey);
    await this.resolve(this.currentKey);
  }

  private reset(): void {
    this.currentKey = null;
    this.currentFingerprint = null;
    lyricsStore.setSnapshot({ ...this.emptySnapshot(), updatedAt: Date.now() });
  }

  private emptySnapshot(): LyricsSnapshot {
    return {
      status: "idle",
      trackKey: null,
      lines: [],
      plainText: null,
      language: "unknown",
      matched: null,
      hasMeasuredWords: false,
      updatedAt: Date.now(),
    };
  }

  private fingerprintOf(track: Track): TrackFingerprint {
    return {
      title: track.title,
      artist: track.artist,
      anime: track.anime,
      raw: track.raw,
      duration: track.duration,
    };
  }

  private async resolve(key: string): Promise<void> {
    const fingerprint = this.currentFingerprint;
    if (!fingerprint || this.inFlightKey === key) return;
    this.inFlightKey = key;

    this.emitStatus("loading", key);

    try {
      const outcome = await this.fetchAndMatch(fingerprint, key);
      if (key !== this.currentKey) return;

      if (outcome.kind === "not-found") {
        this.failures.set(key, { at: Date.now(), kind: "not-found" });
        this.emitStatus("not-found", key);
        return;
      }

      this.failures.delete(key);

      if (outcome.kind === "instrumental") {
        const lyrics: CachedLyrics = {
          kind: "instrumental",
          lines: [],
          plainText: null,
          language: "unknown",
          matched: this.matchedMeta(outcome.candidate),
          hasMeasuredWords: false,
        };
        this.remember(key, lyrics);
        this.emit(lyrics);
        return;
      }

      this.remember(key, outcome.lyrics);
      this.emit(outcome.lyrics);
    } catch (error) {
      if (key !== this.currentKey) return;
      console.error("[LyricsService] resolve failed:", error);
      this.failures.set(key, { at: Date.now(), kind: "error" });
      this.emitStatus("error", key);
    } finally {
      this.inFlightKey = null;
    }
  }

  /**
   * Escalating query ladder: exact provider lookup → title+artist search
   * → raw station title → title alone. Results accumulate so a weak
   * first round can still surface the right row through duration/artist
   * scoring.
   */
  private async fetchAndMatch(
    fingerprint: TrackFingerprint,
    key: string,
  ): Promise<LyricsFetchOutcome> {
    const collected = new Map<number, LyricCandidate>();

    const collect = (rows: LyricCandidate[]) => {
      for (const row of rows) collected.set(row.id, row);
    };

    const title = fingerprint.title.trim();
    const artist = fingerprint.artist.trim();
    const durationSec =
      Number.isFinite(fingerprint.duration) && fingerprint.duration > 0
        ? fingerprint.duration / 1000
        : undefined;

    if (title && artist) {
      const exact = await this.api.getExact({
        trackName: title,
        artistName: artist,
        durationSec,
      });
      if (key !== this.currentKey) return { kind: "not-found" };
      if (exact) collect([exact]);
    }

    const consider = (): LyricsFetchOutcome | null => {
      if (collected.size === 0) return null;
      const best = pickBest([...collected.values()], fingerprint);
      if (!best) return null;
      const lyrics = this.buildLyrics(best.candidate);
      if (!lyrics) return null;
      return lyrics.kind === "instrumental"
        ? { kind: "instrumental", candidate: best.candidate, score: best.score }
        : { kind: "found", lyrics, score: best.score };
    };

    let outcome = consider();
    if (outcome) return outcome;

    if (title && artist) {
      collect(await this.api.search({ trackName: title, artistName: artist }));
      if (key !== this.currentKey) return { kind: "not-found" };
      outcome = consider();
      if (outcome) return outcome;
    }

    if (fingerprint.raw.trim()) {
      collect(await this.api.search({ q: fingerprint.raw }));
      if (key !== this.currentKey) return { kind: "not-found" };
      outcome = consider();
      if (outcome) return outcome;
    }

    if (title) {
      collect(await this.api.search({ trackName: title }));
      if (key !== this.currentKey) return { kind: "not-found" };
      outcome = consider();
      if (outcome) return outcome;
    }

    return { kind: "not-found" };
  }

  private buildLyrics(
    candidate: LyricCandidate,
  ): CachedLyrics | null {
    const matched = this.matchedMeta(candidate);

    if (candidate.instrumental && !candidate.syncedLyrics && !candidate.plainLyrics) {
      return {
        kind: "instrumental",
        lines: [],
        plainText: null,
        language: "unknown",
        matched,
        hasMeasuredWords: false,
      };
    }

    if (candidate.syncedLyrics) {
      const lines = prepareKaraoke(parseLrc(candidate.syncedLyrics));
      if (lines.length > 0) {
        return {
          kind: "synced",
          lines,
          plainText: null,
          language: detectLanguage(lines),
          matched,
          hasMeasuredWords: lines.some((line) => line.wordTimed),
        };
      }
      // A synced body that parses to nothing must not lose the song its
      // plain text — fall through and show the untimed lyrics instead.
    }

    if (candidate.plainLyrics) {
      const text = candidate.plainLyrics.replace(/\r\n/g, "\n").trim();
      if (text.length === 0) {
        return {
          kind: "instrumental",
          lines: [],
          plainText: null,
          language: "unknown",
          matched,
          hasMeasuredWords: false,
        };
      }
      const lines = text
        .split("\n")
        .map((line, index) => ({
          timeMs: index,
          text: line,
          words: [],
          wordTimed: false,
        }));
      return {
        kind: "plain",
        lines,
        plainText: text,
        language: detectLanguage(lines),
        matched,
        hasMeasuredWords: false,
      };
    }

    // Instrumental uploads without the flag: a synced body made only of
    // spacing marks is still "no lyrics to sing".
    return {
      kind: "instrumental",
      lines: [],
      plainText: null,
      language: "unknown",
      matched,
      hasMeasuredWords: false,
    };
  }

  private matchedMeta(candidate: LyricCandidate): MatchedMeta {
    return {
      title: candidate.trackName,
      artist: candidate.artistName,
      album: candidate.albumName,
      duration:
        candidate.durationSec != null && candidate.durationSec > 0
          ? Math.round(candidate.durationSec * 1000)
          : null,
    };
  }

  private emit(lyrics: CachedLyrics): void {
    const snapshot: LyricsSnapshot = {
      status:
        lyrics.kind === "synced" ? "found" : lyrics.kind === "plain" ? "plain" : "instrumental",
      trackKey: this.currentKey,
      lines: lyrics.lines,
      plainText: lyrics.plainText,
      language: lyrics.language,
      matched: lyrics.matched,
      hasMeasuredWords: lyrics.hasMeasuredWords,
      updatedAt: Date.now(),
    };
    lyricsStore.setSnapshot(snapshot);
  }

  private emitStatus(status: LyricsSnapshot["status"], key: string): void {
    lyricsStore.setSnapshot({
      ...this.emptySnapshot(),
      status,
      trackKey: key,
      updatedAt: Date.now(),
    });
  }

  // ─── Disk cache (best effort — the memory cache carries the session) ───

  private async loadCached(key: string): Promise<CachedLyrics | null> {
    const memory = this.cache.get(key);
    if (memory) return memory.lyrics;

    await this.loadStorage();
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.lyrics;
  }

  private remember(key: string, lyrics: CachedLyrics): void {
    this.cache.set(key, { savedAt: Date.now(), lyrics });
    this.prune();
    void this.persist();
  }

  private prune(): void {
    if (this.cache.size <= MAX_CACHE_ENTRIES) return;
    const ordered = [...this.cache.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt);
    for (const [key] of ordered.slice(0, this.cache.size - MAX_CACHE_ENTRIES)) {
      this.cache.delete(key);
    }
  }

  private async loadStorage(): Promise<void> {
    if (!this.storage || this.storageLoad) {
      await this.storageLoad;
      return;
    }
    this.storageLoad = (async () => {
      try {
        const raw = await this.storage?.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return;
        for (const [key, value] of Object.entries(parsed)) {
          const entry = value as { savedAt?: unknown; lyrics?: CachedLyrics };
          if (
            typeof entry?.savedAt !== "number" ||
            !entry.lyrics ||
            !Array.isArray(entry.lyrics.lines)
          ) {
            continue;
          }
          this.cache.set(key, { savedAt: entry.savedAt, lyrics: entry.lyrics });
        }
      } catch {
        // Corrupt cache is a cache miss, not a lyrics failure.
      }
    })();
    await this.storageLoad;
  }

  private async persist(): Promise<void> {
    if (!this.storage) return;
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, entry] of this.cache.entries()) {
        payload[key] = { savedAt: entry.savedAt, lyrics: entry.lyrics };
      }
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage quota/errors must never break the lyrics flow.
    }
  }
}
