import type { IconName } from "@/components/Icon";

/**
 * One glyph per destination, everywhere it is referenced — the drawer item
 * and any row that talks about that destination (e.g. the per-list cover
 * toggles in Settings) — so a symbol always means the same place.
 */
export const DESTINATION_ICON = {
  Home: "play-circle",
  LastRequested: "queue-music",
  LastPlayed: "history",
  MakeRequest: "music-note",
} as const satisfies Record<string, IconName>;
