import { isRealTrack, type Track } from "@/core/domain/track";
import type { ExternalStore } from "@/core/external-store";
import { detectLanguage } from "@/core/lyrics/language";
import { buildTimeline, parseLrc, plainLines, syncedToPlain } from "@/core/lyrics/lrc";
import { isTimedFor, pickBest } from "@/core/lyrics/matcher";
import type { LookupResult, LyricsCache, LyricsProvider } from "@/core/lyrics/ports";
import { LYRICS_IDLE, type LyricsSnapshot } from "@/core/lyrics/store";
import { normalize, type Romanizer } from "@/core/lyrics/text";
import type { Lyrics, LyricsCandidate, LyricsSource, TrackQuery } from "@/core/lyrics/types";

/** Found lyrics are kept this long (ms). */
export const MATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A song without lyrics is asked about again after this (ms). */
export const MISS_TTL_MS = 12 * 60 * 60 * 1000;
/** Lookups remembered in memory for the session. */
const MEMORY_ENTRIES = 40;

/** Bracketed or tilde-wrapped qualifiers: `(Opening)`, `~Hajimari no~`. */
const QUALIFIERS = /[([{【「『≪［（][^)\]}】」』≫］）]*[)\]}】」』≫］）]|[~〜～][^~〜～]*[~〜～]?/g;
/** A trailing `-English Ver.-`. */
const DASHED_SUFFIX = /\s-[^-]+-\s*$/;
const FEATURING = /\s(?:feat\.?|ft\.?|featuring)\s.*$/i;
/**
 * Where the first credit ends: `(CV: …)`, `feat.`, `with`, `,`. Not `&`:
 * band names carry it (`Oranges & Lemons`).
 */
const SECOND_CREDIT = /[(（,、/]|\s(?:feat|ft|featuring|with|vs)\b/i;

/** Title without qualifiers (`Sanctuary (Opening)` → `Sanctuary`), for queries. */
export function queryTitle(title: string): string {
  const core = title
    .replace(QUALIFIERS, " ")
    .replace(DASHED_SUFFIX, " ")
    .replace(FEATURING, " ")
    .replace(/\s+/g, " ")
    .trim();
  return core || title.trim();
}

/** The first credited artist (`A (CV: B) with C` → `A`), for queries. */
export function queryArtist(artist: string): string {
  const cut = artist.search(SECOND_CREDIT);
  const first = (cut > 0 ? artist.slice(0, cut) : artist).trim();
  return first || artist.trim();
}

export interface LyricsServiceDeps {
  provider: LyricsProvider;
  cache: LyricsCache;
  store: ExternalStore<LyricsSnapshot>;
  /** Kana-only, or kanji too once the offline dictionary is loaded. */
  romanizer: () => Romanizer;
  now?: () => number;
}

/**
 * Lyrics for the song being heard: memory → disk cache → LRCLIB, each row
 * validated against the station's metadata (see `matcher.ts`). Lookups are
 * shared between callers and never emitted for a song that is no longer
 * shown.
 */
export class LyricsService {
  private current: { key: string; track: Track } | null = null;
  private readonly memory = new Map<string, Lyrics | null>();
  private readonly inflight = new Map<string, Promise<Lyrics | null>>();
  private readonly now: () => number;

  constructor(private readonly deps: LyricsServiceDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Identity of a song for lookups: title, artist and the cut's length. */
  static keyOf(track: Pick<Track, "title" | "artist" | "duration">): string {
    return [normalize(track.title), normalize(track.artist), Math.round(track.duration / 1000)].join("|");
  }

  /** Whether a track can have lyrics (a song, not a jingle or a bare title). */
  static isSong(track: Track | null | undefined): track is Track {
    return isRealTrack(track) && Boolean(track?.title.trim());
  }

  /** Shows `track`'s lyrics (the lyrics screen follows the heard song). */
  show(track: Track | null | undefined): void {
    if (!LyricsService.isSong(track)) {
      this.current = null;
      this.deps.store.setSnapshot(LYRICS_IDLE);
      return;
    }
    const key = LyricsService.keyOf(track);
    if (this.current?.key === key) return;
    this.current = { key, track };
    void this.load(key, track, false);
  }

  /**
   * The station announced a song, heard a stream lag later: while lyrics are
   * on screen, look it up now so they are there the moment it starts. Nobody
   * looking, no request.
   */
  prefetch(track: Track | null | undefined): void {
    if (!this.current || !LyricsService.isSong(track)) return;
    const key = LyricsService.keyOf(track);
    if (this.memory.has(key)) return;
    this.lookup(key, track, false).catch(() => {});
  }

  /** Asks again after a failure or a miss (user action). */
  retry(): void {
    const current = this.current;
    if (!current) return;
    this.memory.delete(current.key);
    void this.load(current.key, current.track, true);
  }

  /** Stops showing anything (the lyrics screen closed). */
  hide(): void {
    this.current = null;
    this.deps.store.setSnapshot(LYRICS_IDLE);
  }

  /** Forgets every lookup (Storage → clear). */
  async clear(): Promise<void> {
    this.memory.clear();
    await this.deps.cache.clear();
  }

  private async load(key: string, track: Track, force: boolean): Promise<void> {
    const remembered = this.memory.get(key);
    if (remembered !== undefined && !force) {
      this.emit(key, remembered);
      return;
    }
    this.deps.store.setSnapshot({ status: "loading", trackKey: key, lyrics: null });
    try {
      const lyrics = await this.lookup(key, track, force);
      if (this.current?.key === key) this.emit(key, lyrics);
    } catch (error) {
      console.warn("[LyricsService] lookup failed:", error);
      if (this.current?.key === key) {
        this.deps.store.setSnapshot({ status: "error", trackKey: key, lyrics: null });
      }
    }
  }

  private emit(key: string, lyrics: Lyrics | null): void {
    this.deps.store.setSnapshot(
      lyrics ? { status: "ready", trackKey: key, lyrics } : { status: "missing", trackKey: key, lyrics: null },
    );
  }

  /** One lookup per song at a time, shared by `show` and `prefetch`. */
  private lookup(key: string, track: Track, force: boolean): Promise<Lyrics | null> {
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const run = this.runLookup(key, track, force).finally(() => this.inflight.delete(key));
    this.inflight.set(key, run);
    return run;
  }

  private async runLookup(key: string, track: Track, force: boolean): Promise<Lyrics | null> {
    let result: LookupResult | null = null;
    if (!force) {
      const cached = await this.deps.cache.read(key).catch(() => null);
      const ttl = cached?.result.kind === "match" ? MATCH_TTL_MS : MISS_TTL_MS;
      if (cached && this.now() - cached.savedAt < ttl) result = cached.result;
    }
    if (!result) {
      result = await this.resolve(track);
      await this.deps.cache
        .write(key, { savedAt: this.now(), result })
        .catch((error) => console.warn("[LyricsService] cache write failed:", error));
    }
    const lyrics = toLyrics(result);
    this.remember(key, lyrics);
    return lyrics;
  }

  private remember(key: string, lyrics: Lyrics | null): void {
    this.memory.delete(key);
    this.memory.set(key, lyrics);
    if (this.memory.size > MEMORY_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      if (oldest !== undefined) this.memory.delete(oldest);
    }
  }

  /**
   * Exact lookup first (fast, duration-matched), then wider searches whose
   * rows accumulate: a weak first round can still surface the right row. It
   * stops as soon as lyrics timed for this cut are found.
   */
  private async resolve(track: Track): Promise<LookupResult> {
    const { provider } = this.deps;
    const query: TrackQuery = {
      title: track.title,
      artist: track.artist,
      anime: track.anime,
      durationMs: track.duration,
    };
    const title = queryTitle(track.title);
    const artist = queryArtist(track.artist);
    const rows = new Map<number, LyricsCandidate>();
    const collect = (found: readonly (LyricsCandidate | null)[]) => {
      for (const row of found) if (row) rows.set(row.id, row);
    };

    const steps: (() => Promise<readonly (LyricsCandidate | null)[]>)[] = [
      async () =>
        artist && track.duration > 0
          ? [await provider.get({ trackName: title, artistName: artist, durationSec: track.duration / 1000 })]
          : [],
      () => (artist ? provider.search({ trackName: title, artistName: artist }) : Promise.resolve([])),
      () => provider.search({ q: `${artist} ${title}`.trim() }),
      () => provider.search({ trackName: title }),
    ];

    let best = null;
    for (const step of steps) {
      collect(await step());
      best = pickBest(query, [...rows.values()], this.deps.romanizer());
      if (best && isTimedFor(best)) break;
    }
    return best ? { kind: "match", candidate: best.candidate, timed: isTimedFor(best) } : { kind: "none" };
  }
}

function sourceOf(candidate: LyricsCandidate): LyricsSource {
  return {
    provider: "lrclib",
    id: candidate.id,
    title: candidate.trackName,
    artist: candidate.artistName,
    album: candidate.albumName,
    durationMs: candidate.durationSec == null ? null : Math.round(candidate.durationSec * 1000),
  };
}

/** What a lookup shows: timed lyrics, untimed text, an instrumental, or nothing. */
export function toLyrics(result: LookupResult): Lyrics | null {
  if (result.kind === "none") return null;
  const { candidate, timed } = result;
  const source = sourceOf(candidate);

  if (timed && candidate.syncedLyrics) {
    const entries = buildTimeline(parseLrc(candidate.syncedLyrics));
    const lines = entries.flatMap((entry) => (entry.kind === "line" ? [entry.text] : []));
    if (lines.length > 0) {
      return {
        kind: "synced",
        entries,
        wordTimed: entries.some((entry) => entry.kind === "line" && entry.words != null),
        language: detectLanguage(lines),
        source,
      };
    }
  }

  const lines = candidate.plainLyrics
    ? plainLines(candidate.plainLyrics)
    : syncedToPlain(candidate.syncedLyrics ?? "");
  if (lines.length > 0) {
    const otherCut = !timed && candidate.syncedLyrics != null;
    return { kind: "plain", lines, otherCut, language: detectLanguage(lines), source };
  }
  return candidate.instrumental ? { kind: "instrumental", source } : null;
}
