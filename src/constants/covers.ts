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

const COVER_CATEGORY_LABEL_KEYS = {
  live: "SETTINGS_STORAGE_LIVE",
  requested: "SETTINGS_STORAGE_REQUESTED",
  played: "SETTINGS_STORAGE_PLAYED",
  search: "SETTINGS_STORAGE_SEARCH",
} as const satisfies Record<CoverCacheCategory, keyof Dict>;

/** Localized label for one cover-cache category (legend + Advanced rows). */
export function coverCategoryLabel(dict: Dict, key: CoverCacheCategory): string {
  return dict[COVER_CATEGORY_LABEL_KEYS[key]];
}
