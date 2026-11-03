import type { ArtworkQuality } from "animu-api";

/** Quality tiers that ship a bundled preview (everything but "off"). */
export type CoverQualityKey = Exclude<ArtworkQuality, "off">;

export interface CoverQualitySample {
  key: CoverQualityKey;
  source: number;
  sizeBytes: number;
}

// Metro resolves a bundled image `require` to its asset id.

/** Placeholder artwork shown for the "off" tier (nothing is downloaded). */
export const DEFAULT_COVER_SOURCE = require("@/assets/default-cover.png") as number;

/** Ascending quality (and size) so the recommended tier sits mid-list. */
export const COVER_QUALITY_SAMPLES: CoverQualitySample[] = [
  {
    key: "low",
    source: require("@/assets/covers/sample-cover-tiny.jpg") as number,
    sizeBytes: 3684,
  },
  {
    key: "medium",
    source: require("@/assets/covers/sample-cover-medium.jpg") as number,
    sizeBytes: 53202,
  },
  {
    key: "high",
    source: require("@/assets/covers/sample-cover-large.jpg") as number,
    sizeBytes: 114537,
  },
];
