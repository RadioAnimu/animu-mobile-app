import type { Track } from "@/core/domain/track";
import type { PlayerServiceDependencies } from "@/core/player/player-service";
import { debugLog } from "@/utils/player.config";
import { pickPreviewArtwork } from "@/core/player/storage/artwork";

/**
 * Warms the cover of a freshly *announced* track while the speaker is still
 * on the previous one.
 *
 * The station announces a `song_change` a whole stream-lag before the ear
 * reaches it (the sync engine's delay — seconds on iOS, tens of seconds on
 * Android). Downloading the artwork during that window means that when the
 * audible resolver adopts the track, `updateMetadata` finds the file already
 * in the cache and swaps the cover from disk in one push, instead of the
 * "clanky" remote-load-then-swap that lands seconds late.
 *
 * Fire-and-forget: a failed prefetch simply leaves the normal
 * resolve-on-adoption path to do the work. `resolve()` de-dupes against the
 * adoption call through its in-flight map, so this never double-downloads.
 *
 * Fetches the reported low-res sibling (a few KB) in parallel with the
 * full-size cover. The selected-quality image may not have landed by the
 * time the song is heard, but the tiny almost always has — so the cover
 * paints instantly at adoption and swaps up when the full arrives, rather
 * than staying blank. The tiny is resolved under its own URL (not mapped
 * onto the full one) so the adoption call can still drive the full swap.
 */
export function prefetchArtwork(
  deps: Pick<PlayerServiceDependencies, "artwork" | "networkMonitor">,
  track: Track | null | undefined,
): void {
  const url = track?.artwork;
  if (!url || !deps.artwork.isRemote(url)) return;
  if (deps.artwork.peek(url)) return;
  // No link → skip the pointless attempt; the adoption path retries once
  // connectivity (and the track) is live again.
  if (!deps.networkMonitor.isOnline()) return;
  const preview = pickPreviewArtwork(url, track?.artworks);
  debugLog(
    `[ArtDebug] prefetch START "${track?.title ?? "?"}" artwork=${url} preview=${preview ?? "none"}`,
  );
  void Promise.all([
    deps.artwork.resolve(url),
    ...(preview ? [deps.artwork.resolve(preview)] : []),
  ])
    .then(([resolved]) => {
      debugLog(
        `[ArtDebug] prefetch READY "${track?.title ?? "?"}" → ${resolved}`,
      );
    })
    .catch(() => {
      // resolve() already degrades to the remote URL; this only stops an
      // unhandled rejection from ever surfacing.
    });
}
