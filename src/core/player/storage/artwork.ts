import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { artworkSizeRank, type Artworks } from "animu-api";
import DEFAULT_COVER from "@app/assets/default-cover.png";
import { CONFIG, debugLog } from "@/utils/player.config";
import type { Track } from "@/core/domain/track";
import type {
  CoverFileCache,
  FindCachedCoverFile,
  SeedCoverCache,
} from "@/core/player/storage/cover-ports";
import { CoverFileHashMap } from "@/core/player/storage/cover-file-cache";
import {
  ARTWORK_SIZE_RANK,
  normalizeArtworkKey,
} from "@/core/player/storage/cover-image-cache";

export interface ArtworkResolverOptions {
  /**
   * The hashmap behind this resolver (port `CoverFileCache`). Defaults
   * to a fresh `CoverFileHashMap` — inject a pre-loaded one to share
   * state across resolver instances.
   */
  fileMap?: CoverFileCache;
  /**
   * Bridges a freshly downloaded cover file into the disk-image cache so
   * the in-app view renders it instantly (see `cover-image-cache.ts`).
   * Optional — pure-resolver callers skip it.
   */
  onResolved?: SeedCoverCache;
  /**
   * Disk-cache hit check: an already-cached copy (this URL or a larger
   * sibling size) stands in for the download entirely.
   */
  findCachedCoverFile?: FindCachedCoverFile;
}

/** The bundled default cover's on-disk stand-in name space. */
const COVER_FILE_PREFIX = "animu-cover-";

/** Deterministic cache-file name for a remote cover URL (djb2, hex). */
function coverFileName(url: string): string {
  // Slash-normalized: the endpoints spell the same cover both ways and
  // both spellings must land on the same on-disk file (one download).
  return coverFileNameFor(normalizeArtworkKey(url));
}

function coverFileNameFor(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return `${COVER_FILE_PREFIX}${(hash >>> 0).toString(16)}.jpg`;
}

/**
 * Deadline for the direct download before the expo-asset fallback takes
 * over. The CDN occasionally wedges new TCP connections for 10s+ while
 * established streams keep flowing — measured as a 10s default timeout
 * on `FileSystem.downloadFileAsync` followed by a near-immediate
 * success on the fallback client. A shorter deadline hands the request
 * to the fallback at the first stall instead of waiting through it.
 */
const DIRECT_DOWNLOAD_DEADLINE_MS = 5_000;

/** Rejects after `ms` — releases the caller without aborting the work. */
function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof globalThis.setTimeout>;
  const expiry = new Promise<never>((_, reject) => {
    timer = globalThis.setTimeout(() => reject(new Error("download deadline")), ms);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

/**
 * The lowest-rank cover the API actually reported that is smaller than
 * `url` — the progressive-preview candidate.
 *
 * The report matters: deriving `_tiny` from the CDN naming scheme alone
 * is wrong — the CDN 302s unknown sizes to a constant placeholder image,
 * so a guessed sibling downloaded a 404 page (~161KB) as the "preview".
 * `track.artworks` is the server's word on which sizes exist.
 */
export function pickPreviewArtwork(
  url: string | undefined | null,
  artworks?: Artworks | null,
): string | null {
  if (!url || !artworks) return null;
  const current = ARTWORK_SIZE_RANK[artworkSizeRank(url)];
  for (const size of ["tiny", "medium", "large"] as const) {
    const candidate = artworks[size];
    if (
      candidate &&
      candidate !== url &&
      ARTWORK_SIZE_RANK[artworkSizeRank(candidate)] < current
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Makes artwork bulletproof for the native media session.
 *
 * The OS notification/lock-screen loads `artworkUri` with its OWN HTTP
 * stack (no app User-Agent, no retry) — one failed load blanks the cover
 * until the next metadata push, and every retry races the network again.
 * This unit downloads the cover once through the app's own stack and
 * hands the media session a `file://` URI instead: no network race,
 * instant render, works offline.
 *
 * It also owns the bundled default cover (see `assets/default-cover.png`)
 * so every fallback path — this resolver, the API package's
 * `selectArtwork`, the in-app `Cover` fallback — can use an image that is
 * guaranteed to exist.
 */
export class ArtworkResolver {
  /** Remote URL → local `file://` URI hashmap (port, LRU-capped impl below). */
  private readonly fileMap: CoverFileCache;
  /** In-flight downloads — concurrent callers share one download per URL. */
  private readonly inFlight = new Map<string, Promise<string>>();
  /** Spread-identity cache for `apply` — track object → stable wrapper. */
  private readonly appliedTracks = new WeakMap<Track, Track>();
  /** Remote URL until the bundled default cover resolves (see `init`). */
  private defaultCoverValue = CONFIG.DEFAULT_COVER;
  private initPromise: Promise<void> | null = null;
  /** Set by `reset()`; late downloads must not repopulate a destroyed resolver. */
  private disposed = false;

  constructor(private readonly options: ArtworkResolverOptions = {}) {
    this.fileMap = options.fileMap ?? new CoverFileHashMap();
  }

  /**
   * Resolves the bundled default cover to a loadable URI. Release builds
   * ship it inside the app bundle (already local); dev resolves it from
   * the metro server. Idempotent — safe to call from every setup path.
   */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = Asset.fromModule(DEFAULT_COVER)
        .downloadAsync()
        .then((asset) => {
          if (asset.localUri) this.defaultCoverValue = asset.localUri;
        })
        .catch((error) => {
          console.warn(
            "[ArtworkResolver] bundled default cover unavailable, keeping remote fallback:",
            error,
          );
        });
    }
    return this.initPromise;
  }

  /** The bundled file once resolved, the remote URL before that. */
  get defaultCover(): string {
    return this.defaultCoverValue;
  }

  /**
   * Whether a URL needs a download. Non-remote URIs (bundled default,
   * prior `file://` results) are already final — `resolve()` passes them
   * through untouched, so callers should skip the download/re-push dance.
   */
  isRemote(url: string): boolean {
    return /^https?:/i.test(url);
  }

  /** Local URI for a previously resolved remote URL (sync lookup). */
  peek(url: string): string | undefined {
    return this.fileMap.peek(url);
  }

  /**
   * Returns the track with its artwork swapped to the local file when
   * that URL has been resolved — used by the sync metadata builders
   * (`buildNowPlayingMetadata`), which cannot await a download.
   */
  apply(track: Track | null | undefined): Track | null | undefined {
    if (!track?.artwork) return track;
    const local = this.fileMap.peek(track.artwork);
    if (!local) return track;
    // Spread identity cache: `apply` runs on every service emit and the
    // player store diffs snapshots shallowly — a fresh `{...track}` per
    // call would read as "currentTrack changed" forever, re-rendering
    // every consumer on poll ticks with zero real changes. The cached
    // wrapper is returned while the underlying resolution is unchanged.
    const cached = this.appliedTracks.get(track);
    if (cached && cached.artwork === local) return cached;
    const next = { ...track, artwork: local };
    this.appliedTracks.set(track, next);
    return next;
  }

  /**
   * Returns a local `file://` URI for a remote cover.
   *
   * Lookup ladder — past journeys may already have the bytes on disk:
   *
   * 1. this resolver's own lookup (previous media-session resolution);
   * 2. an in-flight download shared with concurrent callers;
   * 3. expo-image's disk cache — the in-app displays (search rows,
   *    history, the player frame) cache every cover they render, and
   *    `findCachedCoverFile` also swaps in a larger sibling when the CDN
   *    scheme allows (e.g. the search-result `large` covering a
   *    `medium` request);
   * 4. a fresh download, seeded back into expo-image (option 3 above
   *    makes the NEXT consumer a cache hit).
   *
   * Failures degrade gracefully to the remote URL — the native loader's
   * best effort is preserved, just without its guarantees.
   */
  async resolve(
    url: string,
    onPreview?: (local: string) => void,
    previewUrl?: string | null,
  ): Promise<string> {
    // Already local (bundled default, prior file URI) — nothing to do
    if (!this.isRemote(url)) return url;
    // Destroyed — never start new work.
    if (this.disposed) return url;

    const cached = this.fileMap.peek(url);
    if (cached) return cached;

    // Progressive preview FIRST, and unconditionally: a prefetch may already
    // hold the full-size download in flight, and the in-flight de-dupe below
    // would otherwise return early and skip the low-res paint entirely.
    this.startPreview(previewUrl, url, onPreview);

    const pending = this.inFlight.get(url);
    if (pending) return pending;

    const startedAt = Date.now();
    debugLog(`[ArtDebug] resolve START ${url}`);

    const promise = this.pipeline(url, startedAt)
      .catch((error) => {
        console.warn(
          `[ArtDebug] resolve FAILED after ${Date.now() - startedAt}ms (${url}):`,
          error,
        );
        return url;
      })
      .finally(() => {
        this.inFlight.delete(url);
      });

    this.inFlight.set(url, promise);
    return promise;
  }

  /**
   * Low-res step of the progressive cover: downloads the reported smaller
   * sibling (a few KB), maps it onto the full URL while the full file is
   * still missing, and reports it via `onPreview`. De-duped through
   * `resolve(previewUrl)`, so a prefetch and the adoption call share one
   * download. Idempotent — safe to call on every `resolve`.
   */
  private startPreview(
    previewUrl: string | null | undefined,
    fullUrl: string,
    onPreview?: (local: string) => void,
  ): void {
    if (!previewUrl || previewUrl === fullUrl) return;
    if (this.fileMap.peek(fullUrl)) return;
    void this.resolve(previewUrl)
      .then((local) => {
        // Map/paint only while the full file is still missing — if it landed
        // first it wins, and the preview must not shadow it. A reset may have
        // run while the download was in flight; a destroyed resolver must
        // not repopulate its map or paint into a dead consumer.
        if (this.disposed) return;
        if (local !== previewUrl && !this.fileMap.peek(fullUrl)) {
          this.fileMap.track(fullUrl, local);
          onPreview?.(local);
        }
      })
      .catch(() => {
        // Best effort — the full download decides the end state.
      });
  }

  /** Cache hit → direct download → expo-asset fallback, for one URL. */
  private async pipeline(url: string, startedAt: number): Promise<string> {
    const cachedFile = await this.options?.findCachedCoverFile?.(url);
    if (cachedFile) {
      debugLog(
        `[ArtDebug] resolve EXPO-IMAGE CACHE HIT after ${Date.now() - startedAt}ms url=${url} file=${cachedFile}`,
      );
      if (this.disposed) return url;
      this.fileMap.track(url, cachedFile);
      return cachedFile;
    }
    // Plain download to a deterministic cache destination — the
    // previous path went through expo-asset's `downloadAsync`, whose
    // asset-cache/hash machinery turned a 60KB image into a
    // 75-second transfer (direct fetch of the same URL: <1s). Files
    // accumulate in the OS cache dir (unlimited, tiny covers), and a
    // pre-existing file short-circuits the network entirely.
    const destination = new File(Paths.cache, coverFileName(url));
    try {
      if (!destination.exists || destination.size === 0) {
        // Raced against a short deadline: a wedged connection must not
        // cost the full native timeout (measured 10s) before the
        // fallback even starts. The direct attempt keeps running
        // underneath — if it lands later it still fills the
        // deterministic cache file for next time.
        const direct = File.downloadFileAsync(url, destination);
        direct.catch(() => {}); // late failures are cache-only misses
        await deadline(direct, DIRECT_DOWNLOAD_DEADLINE_MS);
      }
    } catch (error) {
      console.warn(
        `[ArtDebug] resolver direct download failed (${url}):`,
        error,
      );
      // Fall through to the original expo-asset path as a backup. The
      // direct attempt is deadline-bounded above; without the same guard
      // here a fallback that never settles would keep `resolve()` pending
      // forever and latch its entry in `inFlight`, so that cover could never
      // retry. The deadline releases the caller; the work itself is left to
      // finish (or not) as a cache-only miss.
      return deadline(
        Asset.fromURI(url).downloadAsync(),
        DIRECT_DOWNLOAD_DEADLINE_MS,
      ).then((asset) => {
        if (this.disposed) return url;
        const local = asset.localUri ?? url;
        debugLog(
          `[ArtDebug] resolve DOWNLOAD(expo-asset fallback) done after ${Date.now() - startedAt}ms url=${url} local=${local}`,
        );
        this.fileMap.track(url, local);
        if (asset.localUri) void this.options?.onResolved?.(asset.localUri, url);
        return local;
      });
    }
    if (!destination.exists || destination.size === 0) {
      throw new Error(`cover download produced an empty file (${url})`);
    }
    if (this.disposed) return url;
    const local = destination.uri;
    debugLog(
      `[ArtDebug] resolve DOWNLOAD done after ${Date.now() - startedAt}ms size=${destination.size} url=${url} local=${local}`,
    );
    this.fileMap.track(url, local);
    void this.options?.onResolved?.(local, url);
    return local;
  }

  /** Destroy path: drop the in-memory lookups (cache files are OS-owned). */
  reset(): void {
    this.disposed = true;
    this.fileMap.clear();
    this.inFlight.clear();
  }
}
