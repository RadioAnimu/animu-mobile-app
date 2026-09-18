import type { CoverCacheCategory } from "./cover-cache-registry.service";

/** Stable display / iteration order for the four cover-cache partitions. */
export const CATEGORY_ORDER: CoverCacheCategory[] = [
  "live",
  "requested",
  "played",
  "search",
];

export type CoverCachePartitions = Partial<Record<CoverCacheCategory, number>>;

/**
 * How the ONE user-defined limit is implicitly split into per-category
 * partitions — NOT equally, because the surfaces churn at very different
 * rates (a request-search browsing session floods new covers every few
 * seconds, while the live player replaces one cover per song):
 *
 * - `live` (30%)     — the player's artwork. Small and precious: losing
 *   the current cover costs a re-download exactly when the user is
 *   listening. Gets the same share as its slow churn demands.
 * - `requested` (15%)— last requests. A bounded history that turns over
 *   on every request; stale entries are worthless quickly.
 * - `played` (25%)   — recently played. A larger history users actually
 *   scroll back through, moderately patient.
 * - `search` (30%)   — request-search results. The fastest-churning
 *   surface: rows flash by while typing, so its partition can be big
 *   and evicted aggressively — it is exactly design-safe to lose.
 *
 * Partitions EVICT INDEPENDENTLY: a search flood can never push out a
 * live cover, and vice versa. Each partition keeps its own newest entry.
 */
export const PARTITION_WEIGHTS: Record<CoverCacheCategory, number> = {
  live: 0.3,
  requested: 0.15,
  played: 0.25,
  search: 0.3,
};

/**
 * Resolves the per-partition byte caps for a total limit. Customized
 * partitions take their absolute values off the top; whatever is left is
 * shared among the un-customized ones proportionally to the weights, so
 * a user who only overrides "search" still gets a coherent whole — the
 * total never grows beyond the number they typed.
 *
 * `maxBytes <= 0` (unlimited) returns `null` — no caps, no trimming.
 */
export function resolvePartitionCaps(
  maxBytes: number,
  custom: CoverCachePartitions | null | undefined = null,
): Record<CoverCacheCategory, number> | null {
  if (maxBytes <= 0) return null;

  const caps: Record<CoverCacheCategory, number> = {
    live: 0,
    requested: 0,
    played: 0,
    search: 0,
  };
  let reserved = 0;
  let uncappedWeight = 0;

  for (const key of CATEGORY_ORDER) {
    const customBytes = custom?.[key];
    if (customBytes == null) {
      uncappedWeight += PARTITION_WEIGHTS[key];
    } else {
      const bytes = Math.max(0, customBytes);
      caps[key] = bytes;
      reserved += bytes;
    }
  }

  if (uncappedWeight > 0) {
    const leftover = Math.max(0, maxBytes - reserved);
    for (const key of CATEGORY_ORDER) {
      if (custom?.[key] == null) {
        caps[key] = Math.round(
          (leftover * PARTITION_WEIGHTS[key]) / uncappedWeight,
        );
      }
    }
  }

  return caps;
}

/**
 * The automatic share of one partition, as a fraction of the total, when
 * nothing is customized. Used to label "Automatic (30%)" before a custom
 * override shifts the split.
 */
export function automaticSharePercent(key: CoverCacheCategory): number {
  return Math.round(PARTITION_WEIGHTS[key] * 100);
}
