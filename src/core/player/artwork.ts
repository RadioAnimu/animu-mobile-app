import { Asset } from "expo-asset";
import DEFAULT_COVER from "../../../assets/default-cover.png";
import { CONFIG } from "../../utils/player.config";
import type { Track } from "../domain/track";

/**
 * In-memory lookup cap for resolved covers. The underlying files live in
 * the OS-owned cache directory (expo-asset dedupes by URL, and the OS
 * evicts under storage pressure) — only the lookup map is bounded here.
 */
const MAX_TRACKED_ARTWORKS = 64;

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
  /** Remote URL → local `file://` URI (insertion-ordered LRU lookup). */
  private resolved = new Map<string, string>();
  /** In-flight downloads — concurrent callers share one download per URL. */
  private inFlight = new Map<string, Promise<string>>();
  /** Remote URL until the bundled default cover resolves (see `init`). */
  private defaultCoverValue = CONFIG.DEFAULT_COVER;
  private initPromise: Promise<void> | null = null;

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

  /** Local URI for a previously resolved remote URL (sync lookup). */
  peek(url: string): string | undefined {
    return this.resolved.get(url);
  }

  /**
   * Returns the track with its artwork swapped to the local file when
   * that URL has been resolved — used by the sync metadata builders
   * (`buildNowPlayingMetadata`), which cannot await a download.
   */
  apply(track: Track | null | undefined): Track | null | undefined {
    if (!track?.artwork) return track;
    const local = this.resolved.get(track.artwork);
    return local ? { ...track, artwork: local } : track;
  }

  /**
   * Downloads a remote cover and resolves to a local `file://` URI.
   * Failures degrade gracefully to the remote URL — the native loader's
   * best effort is preserved, just without its guarantees.
   */
  async resolve(url: string): Promise<string> {
    // Already local (bundled default, prior file URI) — nothing to do
    if (!/^https?:/i.test(url)) return url;

    const cached = this.resolved.get(url);
    if (cached) return cached;

    const pending = this.inFlight.get(url);
    if (pending) return pending;

    const promise = Asset.fromURI(url)
      .downloadAsync()
      .then((asset) => {
        const local = asset.localUri ?? url;
        this.track(url, local);
        return local;
      })
      .catch((error) => {
        console.warn(`[ArtworkResolver] download failed (${url}):`, error);
        return url;
      })
      .finally(() => {
        this.inFlight.delete(url);
      });

    this.inFlight.set(url, promise);
    return promise;
  }

  /** Destroy path: drop the in-memory lookups (cache files are OS-owned). */
  reset(): void {
    this.resolved.clear();
    this.inFlight.clear();
  }

  private track(url: string, local: string): void {
    this.resolved.delete(url);
    this.resolved.set(url, local);
    if (this.resolved.size > MAX_TRACKED_ARTWORKS) {
      const oldest = this.resolved.keys().next().value;
      if (oldest != null) this.resolved.delete(oldest);
    }
  }
}
