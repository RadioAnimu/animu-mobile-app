import type { CoverCacheCategory } from "@/core/services/cover-cache-registry.service";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";

/**
 * One color per cached-cover category — visually distinct on the deep
 * purple surface while staying inside the app's palette family.
 */
export const COVER_CATEGORY_COLORS: Record<CoverCacheCategory, string> = {
  live: THEME.COLORS.BRAND,
  requested: "#C77DFF",
  played: "#4FC3F7",
  search: "#FFCF56",
};

/** Localized label for one cover-cache category (legend + Advanced rows). */
export function coverCategoryLabel(dict: Dict, key: CoverCacheCategory): string {
  switch (key) {
    case "live":
      return dict.SETTINGS_STORAGE_LIVE;
    case "requested":
      return dict.SETTINGS_STORAGE_REQUESTED;
    case "played":
      return dict.SETTINGS_STORAGE_PLAYED;
    case "search":
      return dict.SETTINGS_STORAGE_SEARCH;
  }
}
