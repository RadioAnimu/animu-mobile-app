import { useEffect, useState } from "react";
import { playerService } from "@/core/player";
import { pickPreviewArtwork } from "@/core/player/storage/artwork";
import type { Artworks } from "animu-api";

/**
 * Resolves a remote artwork URL to the shared resolver's local `file://`
 * URI — the same download the media session runs (one fetch, deduped via
 * the resolver's in-flight map), so the in-app cover never re-downloads
 * the same bytes expo-image was about to fetch itself. Two parallel
 * fetches of the same cover were measured at 33s/44s over a hotspot.
 *
 * While the file isn't ready yet the hook returns `undefined` (render the
 * bundled default), and on failure it falls back to the remote URL —
 * expo-image's own loader is then the last resort, exactly like the
 * media session's degradation path.
 */
export function useResolvedArtwork(
  url: string | undefined,
  artworks?: Artworks,
): string | undefined {
  const service = playerService();

  const [resolved, setResolved] = useState<string | undefined>(() =>
    url ? service.peekArtwork(url) : undefined,
  );

  useEffect(() => {
    if (!url) {
      setResolved(undefined);
      return;
    }
    let cancelled = false;
    const local = service.peekArtwork(url);
    setResolved(local);
    if (local) return;
    setResolved(undefined);
    service
      .resolveArtwork(
        url,
        (preview) => {
          // Low-res preview lands first — paint it, upgrade on the final
          // resolution below.
          if (!cancelled) setResolved(preview);
        },
        pickPreviewArtwork(url, artworks),
      )
      .then((result) => {
        if (!cancelled) setResolved(result);
      })
      .catch(() => {
        if (!cancelled) setResolved(url);
      });
    return () => {
      cancelled = true;
    };
  }, [url, artworks, service]);

  return url ? resolved ?? undefined : undefined;
}
