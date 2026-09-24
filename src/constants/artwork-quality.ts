import type { ArtworkQuality } from "@/@types/artwork-quality";

/** Quality tiers that ship a bundled preview (everything but "off"). */
export type CoverQualityKey = Exclude<ArtworkQuality, "off">;

export interface CoverQualitySample {
  key: CoverQualityKey;
  source: number;
  sizeBytes: number;
}

/** Placeholder artwork shown for the "off" tier (nothing is downloaded). */
export const DEFAULT_COVER_SOURCE = require("@app/assets/default-cover.png");

/** Ascending quality (and size) so the recommended tier sits mid-list. */
export const COVER_QUALITY_SAMPLES: CoverQualitySample[] = [
  {
    key: "low",
    source: require("@/assets/covers/sample-cover-tiny.jpg"),
    sizeBytes: 3684,
  },
  {
    key: "medium",
    source: require("@/assets/covers/sample-cover-medium.jpg"),
    sizeBytes: 53202,
  },
  {
    key: "high",
    source: require("@/assets/covers/sample-cover-large.jpg"),
    sizeBytes: 114537,
  },
];
