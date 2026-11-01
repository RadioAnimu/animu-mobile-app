import { Asset } from "expo-asset";
import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { fetch } from "expo/fetch";
import { artworkSizeRank, type Artworks } from "animu-api";
import DEFAULT_COVER from "@/assets/default-cover.png";
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
/**
 * Downloaded covers kept on disk (the lookup's own size): the OS never
 * purges its cache directory on its own, so older ones are deleted.
 */
const MAX_COVER_FILES = 64;

/** One of this resolver's downloads (not a `.part` in progress, not the image cache's). */
const isCoverDownload = (fileUri: string) => {
  const name = fileUri.slice(fileUri.lastIndexOf("/") + 1);
  return name.startsWith(COVER_FILE_PREFIX) && !name.endsWith(".part");
};

/** The covers this resolver downloaded, newest first (in-progress `.part` files excluded). */
function coverFiles(): File[] {
  return new Directory(Paths.cache)
    .list()
    .filter((item): item is File => item instanceof File && isCoverDownload(item.uri))
    .map((file) => ({ file, modified: file.lastModified ?? 0 }))
    .sort((a, b) => b.modified - a.modified)
    .map(({ file }) => file);
}

/** Deterministic cache-file name for a remote cover URL (djb2, hex). */
function coverFileName(url: string): string {
  // Slash-normalized: the endpoints spell the same cover both ways and
  // both spellings must land on the same on-disk file (one download).
  return coverFileNameFor(normalizeArtworkKey(url));
}

function coverFileNameFor(key: string): string {
  let hash = 5381;
  // Split into UTF-16 units to preserve existing cache keys, including surrogates.
  for (const unit of key.split("")) {
    const codeUnit = unit.codePointAt(0) ?? 0;
    hash = (Math.imul(hash, 33) + codeUnit) >>> 0;
  }
  return `${COVER_FILE_PREFIX}${(hash >>> 0).toString(16)}.jpg`;
}

/**
 * Deadline for the direct download before the fetch fallback takes
 * over. The CDN occasionally wedges new TCP connections for 10s+ while
 * established streams keep flowing — measured as a 10s default timeout
 * on `FileSystem.downloadFileAsync` followed by a near-immediate
 * success on the fallback client. A shorter deadline hands the request
 * to the fallback at the first stall instead of waiting through it.
 */
const DIRECT_DOWNLOAD_DEADLINE_MS = 5_000;

/**
 * The native media sessions show local files only; the browser's loads the
 * cover by URL (and the HTTP cache keeps it), so on web nothing is downloaded.
 */
const DOWNLOADS_COVERS = Platform.OS !== "web";

let partFileSeq = 0;

/**
 * Lands a cover in the cache as `name`, but only ever exposes a complete
 * file under that name: `write` fills a private `.part` file that is renamed
 * onto `name` once the transfer finished.
 *
 * A download written straight into its destination made the final name
 * exist — non-empty — for the whole transfer. A resolve running meanwhile
 * (the prefetch's download outliving its deadline, then the adoption's
 * resolve) took that half-written file as done, and the native media session
 * read it once and kept those bytes for the path: a broken lock-screen cover
 * until the app restarted, while the in-app view (decoding later) looked fine.
 */
async function landComplete(name: string, write: (part: File) => Promise<unknown>): Promise<File> {
  const destination = new File(Paths.cache, name);
  // Unique per transfer: two downloads of one cover never share a part file.
  partFileSeq += 1;
  const part = new File(
    Paths.cache,
    `${name}.${Date.now().toString(36)}-${partFileSeq}.part`,
  );
  try {
    await write(part);
    if (destination.exists && destination.size > 0) {
      part.delete(); // A concurrent download already landed it.
    } else {
      part.rename(name);
    }
  } catch (error) {
    if (part.exists) part.delete();
    // Lost a rename race to a concurrent download: its file is complete too.
    if (!(destination.exists && destination.size > 0)) throw error;
  }
  return destination;
}

/** The download client: expo-file-system's native one. */
const downloadComplete = (url: string, name: string) =>
  landComplete(name, (part) => File.downloadFileAsync(url, part));

/**
 * The second client (`expo/fetch`, which keeps working in the background
 * like the first), for when the first one's connection wedges:
 * the CDN occasionally stalls a new connection on one client while another
 * gets through at once. Lands the same file, so it is capped and wiped alike.
 */
const fetchComplete = (url: string, name: string) =>
  landComplete(name, async (part) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    part.write(new Uint8Array(await response.arrayBuffer()));
  });

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
 * It also owns the bundled default cover (see `src/assets/default-cover.png`)
 * so every fallback path — this resolver, the API package's
 * `selectArtwork`, the in-app `Cover` fallback — can use an image that is
 * guaranteed to exist.
 */
export class ArtworkResolver {
  /** Remote URL → local `file://` URI hashmap (port, LRU-capped impl below). */
  private readonly fileMap: CoverFileCache;
  /** In-flight downloads — concurrent callers share one download per URL. */
  private readonly inFlight = new Map<string, Promise<string>>();
  /**
   * Full URL → the low-res preview file mapped onto it while its own
   * download runs. Lets a failed full download take the preview back off
   * the full URL instead of leaving the miniature as "the" cover.
   */
  private readonly previewFor = new Map<string, string>();
  /** Spread-identity cache for `apply` — track object → stable wrapper. */
  private readonly appliedTracks = new WeakMap<Track, Track>();
  /** Remote URL until the bundled default cover resolves (see `init`). */
  private defaultCoverValue = CONFIG.DEFAULT_COVER;
  private initPromise: Promise<void> | null = null;
  /**
   * A download that outlived its deadline landed after all (the resolve
   * already answered with the remote URL). The lock screen only shows local
   * files, so whoever published that cover must publish it again.
   */
  onLateResolve: ((url: string) => void) | null = null;
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
    this.initPromise ??= Asset.fromModule(DEFAULT_COVER)
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
    return DOWNLOADS_COVERS && /^https?:/i.test(url);
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
    if (cached?.artwork === local) return cached;
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
        // The preview stood in for the full file only until it landed. Left
        // mapped, every later lookup (the store's apply(), the media session,
        // a retry's peek) would serve the miniature as the final cover — and
        // the peek would also stop anyone from retrying the download.
        const preview = this.previewFor.get(url);
        if (preview && this.fileMap.peek(url) === preview) {
          this.fileMap.forget(url);
        }
        return url;
      })
      .finally(() => {
        this.inFlight.delete(url);
        this.previewFor.delete(url);
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
        // Only while the full download is still running: a preview landing
        // after the full one failed would otherwise pin the miniature.
        if (
          local !== previewUrl &&
          !this.fileMap.peek(fullUrl) &&
          this.inFlight.has(fullUrl)
        ) {
          this.fileMap.track(fullUrl, local);
          this.previewFor.set(fullUrl, local);
          onPreview?.(local);
        }
      })
      .catch(() => {
        // Best effort — the full download decides the end state.
      });
  }

  /** Cache hit → direct download → fetch fallback, for one URL. */
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
    const name = coverFileName(url);
    const destination = new File(Paths.cache, name);
    // Every landed download, in time or late, is adopted and keeps the
    // folder capped.
    const landed = (file: File) => {
      this.adoptLate(url, file.uri);
      this.pruneDownloads();
    };
    try {
      if (!destination.exists || destination.size === 0) {
        // Raced against a short deadline: a wedged connection must not
        // cost the full native timeout (measured 10s) before the
        // fallback even starts. The direct attempt keeps running
        // underneath — if it lands later it fills the deterministic cache
        // file and is adopted then (see `adoptLate`).
        const direct = downloadComplete(url, name);
        direct.then(landed, () => {}); // late failures are cache-only misses
        await deadline(direct, DIRECT_DOWNLOAD_DEADLINE_MS);
      }
    } catch (error) {
      console.warn(
        `[ArtDebug] resolver direct download failed (${url}):`,
        error,
      );
      // Fall through to the second client as a backup. The direct attempt
      // is deadline-bounded above; without the same guard here a fallback
      // that never settles would keep `resolve()` pending forever and latch
      // its entry in `inFlight`, so that cover could never retry. The
      // deadline releases the caller; the work itself is left to finish (or
      // not) as a cache-only miss.
      const fallback = fetchComplete(url, name);
      fallback.then(landed, () => {}); // late failures are cache-only misses
      return deadline(fallback, DIRECT_DOWNLOAD_DEADLINE_MS).then((file) => {
        if (this.disposed) return url;
        debugLog(
          `[ArtDebug] resolve DOWNLOAD(fetch fallback) done after ${Date.now() - startedAt}ms url=${url} local=${file.uri}`,
        );
        this.fileMap.track(url, file.uri);
        void this.options?.onResolved?.(file.uri, url);
        return file.uri;
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

  /**
   * The cover cache was wiped: the image library deleted its files, so the
   * lookups that pointed into it go, and the downloads are pruned but for
   * the shown cover's. A shown cover that lived in the image cache is
   * fetched again and republished ({@link onLateResolve}).
   */
  afterCacheWipe(shownUrl?: string): void {
    if (!DOWNLOADS_COVERS || this.disposed) return;
    this.fileMap.forgetWhere((fileUri) => !isCoverDownload(fileUri));
    const shown = shownUrl ? this.fileMap.peek(shownUrl) : undefined;
    this.pruneDownloads(0, shown);
    if (shownUrl && !shown && this.isRemote(shownUrl)) {
      void this.resolve(shownUrl)
        .then(() => this.onLateResolve?.(shownUrl))
        .catch(() => {});
    }
  }

  /**
   * Deletes downloaded covers past the newest `keep`, and the lookups that
   * pointed at them — never `protect`, the file the media session shows
   * (Android may read it again; it is not always the newest: the next
   * song's cover is fetched before it is heard).
   */
  pruneDownloads(keep: number = MAX_COVER_FILES, protect?: string): void {
    if (!DOWNLOADS_COVERS || this.disposed) return;
    try {
      for (const file of coverFiles().slice(keep)) {
        const uri = file.uri;
        if (uri === protect) continue;
        file.delete();
        this.fileMap.forgetWhere((fileUri) => fileUri === uri);
      }
    } catch (error) {
      console.warn("[ArtworkResolver] cover cleanup failed:", error);
    }
  }

  /**
   * Adopts a downloaded file when nothing real holds its URL yet (unmapped,
   * or just its stand-in preview). Runs for every direct/fallback download,
   * including ones that outlived their deadline. While the URL's resolve is
   * still running, recording the file is enough: its settle republishes and
   * every reader goes through the map. Once it has settled (it answered with
   * the remote URL), nobody would look again — {@link onLateResolve} says so.
   */
  private adoptLate(url: string, local: string): void {
    if (this.disposed) return;
    const mapped = this.fileMap.peek(url);
    if (mapped && mapped !== this.previewFor.get(url)) return;
    this.fileMap.track(url, local);
    this.previewFor.delete(url);
    if (this.inFlight.has(url)) return;
    debugLog(`[ArtDebug] resolve LATE landing url=${url} local=${local}`);
    void this.options?.onResolved?.(local, url);
    this.onLateResolve?.(url);
  }

  /** Destroy path: drop the in-memory lookups (cache files are OS-owned). */
  reset(): void {
    this.disposed = true;
    this.fileMap.clear();
    this.inFlight.clear();
    this.previewFor.clear();
  }
}
