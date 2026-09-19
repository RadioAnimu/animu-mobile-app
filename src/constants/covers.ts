import type { CoverCacheCategory } from "@/core/services/cover-cache-registry.service";
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
