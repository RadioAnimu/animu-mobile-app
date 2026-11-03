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
  /** URL → file lookup; defaults to a fresh `CoverFileHashMap`. */
  fileMap?: CoverFileCache;
  /** Seeds a fresh download into the image cache, so the in-app view renders it at once. */
  onResolved?: SeedCoverCache;
  /** An image-cache copy (this URL or a larger size) that replaces the download. */
  findCachedCoverFile?: FindCachedCoverFile;
}

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
  // Slash-normalized: the endpoints spell one cover both ways.
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
 * Deadline before the fetch fallback takes over: the CDN sometimes wedges a
 * new connection for 10 s+ while the other client gets through at once.
 */
const DIRECT_DOWNLOAD_DEADLINE_MS = 5_000;

/**
 * The native media sessions show local files only; the browser's loads the
 * cover by URL (and the HTTP cache keeps it), so on web nothing is downloaded.
 */
const DOWNLOADS_COVERS = Platform.OS !== "web";

let partFileSeq = 0;

/**
 * Lands a cover as `name`, only ever exposing a complete file: `write` fills
 * a private `.part` file, renamed once done. A half-written file under the
 * final name would be taken as done, and the media session keeps the bytes
 * it read for a path.
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

/** The native download client. */
const downloadComplete = (url: string, name: string) =>
  landComplete(name, (part) => File.downloadFileAsync(url, part));

/** The fallback client (`expo/fetch`, also background-safe), landing the same file. */
const fetchComplete = (url: string, name: string) =>
  landComplete(name, async (part) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await part.write(new Uint8Array(await response.arrayBuffer()));
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
 * The smallest reported cover below `url`'s size: the progressive preview.
 * Only reported sizes: the CDN redirects unknown ones to a placeholder.
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
 * Local cover files for the native media session, whose own loader has no
 * retry (one failed load blanks the lock screen): each cover is downloaded
 * once and handed over as a `file://` URI. Also owns the bundled default.
 */
export class ArtworkResolver {
  private readonly fileMap: CoverFileCache;
  /** Concurrent callers share one download per URL. */
  private readonly inFlight = new Map<string, Promise<string>>();
  /** Full URL → the preview mapped onto it meanwhile, taken back if the full download fails. */
  private readonly previewFor = new Map<string, string>();
  /** Stable wrappers for `apply`. */
  private readonly appliedTracks = new WeakMap<Track, Track>();
  /** Remote URL until the bundled default cover resolves (see `init`). */
  private defaultCoverValue = CONFIG.DEFAULT_COVER;
  private initPromise: Promise<void> | null = null;
  /** A download that outlived its deadline landed: whoever published that cover must again. */
  onLateResolve: ((url: string) => void) | null = null;
  private disposed = false;

  constructor(private readonly options: ArtworkResolverOptions = {}) {
    this.fileMap = options.fileMap ?? new CoverFileHashMap();
  }

  /** Resolves the bundled default cover to a loadable URI. Idempotent. */
  init(): Promise<void> {
    // `*.png` modules are untyped (an asset id on native, a URL on web).
    this.initPromise ??= Asset.fromModule(DEFAULT_COVER as Parameters<typeof Asset.fromModule>[0])
      .downloadAsync()
      .then((asset) => {
        if (asset.localUri) this.defaultCoverValue = asset.localUri;
      })
      .catch((error: unknown) => {
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

  /** Whether a URL needs a download (non-remote URIs, and all on the web, are final). */
  isRemote(url: string): boolean {
    return DOWNLOADS_COVERS && /^https?:/i.test(url);
  }

  /** Local URI for a previously resolved remote URL (sync lookup). */
  peek(url: string): string | undefined {
    return this.fileMap.peek(url);
  }

  /** The track with its artwork swapped to the local file, once resolved (sync). */
  apply(track: Track | null | undefined): Track | null | undefined {
    if (!track?.artwork) return track;
    const local = this.fileMap.peek(track.artwork);
    if (!local) return track;
    // Same wrapper while unchanged: the store diffs shallowly, and a fresh
    // object per emit would re-render every consumer.
    const cached = this.appliedTracks.get(track);
    if (cached?.artwork === local) return cached;
    const next = { ...track, artwork: local };
    this.appliedTracks.set(track, next);
    return next;
  }

  /**
   * A local `file://` URI for a remote cover: this lookup, a shared in-flight
   * download, the image cache (or a larger size there), else a download
   * seeded back into it. A failure answers with the remote URL.
   */
  async resolve(
    url: string,
    onPreview?: (local: string) => void,
    previewUrl?: string | null,
  ): Promise<string> {
    if (!this.isRemote(url)) return url;
    if (this.disposed) return url;

    const cached = this.fileMap.peek(url);
    if (cached) return cached;

    // Before the in-flight de-dupe: a prefetch may hold the full download.
    this.startPreview(previewUrl, url, onPreview);

    const pending = this.inFlight.get(url);
    if (pending) return pending;

    const startedAt = Date.now();
    debugLog(`[ArtDebug] resolve START ${url}`);

    const promise = this.pipeline(url, startedAt)
      .catch((error: unknown) => {
        console.warn(
          `[ArtDebug] resolve FAILED after ${Date.now() - startedAt}ms (${url}):`,
          error,
        );
        // Left mapped, the preview would serve as the final cover and block retries.
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

  /** Maps the small preview onto the full URL while its download runs, and paints it. */
  private startPreview(
    previewUrl: string | null | undefined,
    fullUrl: string,
    onPreview?: (local: string) => void,
  ): void {
    if (!previewUrl || previewUrl === fullUrl) return;
    if (this.fileMap.peek(fullUrl)) return;
    void this.resolve(previewUrl)
      .then((local) => {
        if (this.disposed) return;
        // Only while the full file is missing and its download still runs.
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
        // Best effort: the full download decides.
      });
  }

  /** Cache hit → direct download → fetch fallback, for one URL. */
  private async pipeline(url: string, startedAt: number): Promise<string> {
    const cachedFile = await this.options.findCachedCoverFile?.(url);
    if (cachedFile) {
      debugLog(
        `[ArtDebug] resolve EXPO-IMAGE CACHE HIT after ${Date.now() - startedAt}ms url=${url} file=${cachedFile}`,
      );
      if (this.disposed) return url;
      this.fileMap.track(url, cachedFile);
      return cachedFile;
    }
    // A deterministic file name: an existing file skips the network.
    const name = coverFileName(url);
    const destination = new File(Paths.cache, name);
    // Every landed download, in time or late, is adopted; the folder stays capped.
    const landed = (file: File) => {
      this.adoptLate(url, file.uri);
      this.pruneDownloads();
    };
    try {
      if (!destination.exists || destination.size === 0) {
        // The direct attempt keeps running past its deadline; a late landing is adopted.
        const direct = downloadComplete(url, name);
        direct.then(landed, () => {}); // late failures are cache-only misses
        await deadline(direct, DIRECT_DOWNLOAD_DEADLINE_MS);
      }
    } catch (error) {
      console.warn(
        `[ArtDebug] resolver direct download failed (${url}):`,
        error,
      );
      // Deadline-bounded too: a fallback that never settles would latch
      // `inFlight`, and that cover could never retry.
      const fallback = fetchComplete(url, name);
      fallback.then(landed, () => {}); // late failures are cache-only misses
      return deadline(fallback, DIRECT_DOWNLOAD_DEADLINE_MS).then((file) => {
        if (this.disposed) return url;
        debugLog(
          `[ArtDebug] resolve DOWNLOAD(fetch fallback) done after ${Date.now() - startedAt}ms url=${url} local=${file.uri}`,
        );
        this.fileMap.track(url, file.uri);
        void this.options.onResolved?.(file.uri, url);
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
    void this.options.onResolved?.(local, url);
    return local;
  }

  /**
   * The cover cache was wiped: lookups into the image cache go, downloads are
   * pruned but the shown one, and a shown cover that lived there is refetched.
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
   * Deletes downloads past the newest `keep`, and their lookups, never
   * `protect`: the media session's file (not always the newest, since the
   * next song's cover is fetched first).
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
   * Adopts a landed download when only a preview, or nothing, holds its URL.
   * After its resolve already answered with the remote URL, nobody would look
   * again: {@link onLateResolve} says so.
   */
  private adoptLate(url: string, local: string): void {
    if (this.disposed) return;
    const mapped = this.fileMap.peek(url);
    if (mapped && mapped !== this.previewFor.get(url)) return;
    this.fileMap.track(url, local);
    this.previewFor.delete(url);
    if (this.inFlight.has(url)) return;
    debugLog(`[ArtDebug] resolve LATE landing url=${url} local=${local}`);
    void this.options.onResolved?.(local, url);
    this.onLateResolve?.(url);
  }

  /** Destroy: drops the in-memory lookups. */
  reset(): void {
    this.disposed = true;
    this.fileMap.clear();
    this.inFlight.clear();
    this.previewFor.clear();
  }
}
