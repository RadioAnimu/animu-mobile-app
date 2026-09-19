import type { ArtworkQuality } from "../@types/artwork-quality";

/** Quality tiers that ship a bundled preview (everything but "off"). */
export type CoverQualityKey = Exclude<ArtworkQuality, "off">;

export interface CoverQualitySample {
  key: CoverQualityKey;
  source: number;
  sizeBytes: number;
}

/** Placeholder artwork shown for the "off" tier (nothing is downloaded). */
export const DEFAULT_COVER_SOURCE = require("../../assets/default-cover.png");

export const COVER_QUALITY_SAMPLES: CoverQualitySample[] = [
  {
    key: "high",
    source: require("../assets/covers/sample-cover-large.jpg"),
    sizeBytes: 253960,
  },
  {
    key: "medium",
    source: require("../assets/covers/sample-cover-medium.jpg"),
    sizeBytes: 52551,
  },
  {
    key: "low",
    source: require("../assets/covers/sample-cover-tiny.jpg"),
    sizeBytes: 4045,
  },
];
