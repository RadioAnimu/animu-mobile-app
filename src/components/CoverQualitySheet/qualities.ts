import type { ArtworkQuality } from "../../@types/artwork-quality";

/** Cover quality the sheet previews (the "off" option lives in the toggle). */
export type CoverQualityKey = Exclude<ArtworkQuality, "off">;

export interface CoverQualitySample {
  key: CoverQualityKey;
  source: number;
  pixelWidth: number;
  pixelHeight: number;
  sizeBytes: number;
}

/** Now-playing track the bundled samples were captured from. */
export const SAMPLE_TRACK_LABEL = "Sora no Hikari — Chata";

export const COVER_QUALITY_SAMPLES: CoverQualitySample[] = [
  {
    key: "high",
    source: require("../../assets/covers/sample-cover-large.jpg"),
    pixelWidth: 1500,
    pixelHeight: 1391,
    sizeBytes: 253960,
  },
  {
    key: "medium",
    source: require("../../assets/covers/sample-cover-medium.jpg"),
    pixelWidth: 500,
    pixelHeight: 464,
    sizeBytes: 52551,
  },
  {
    key: "low",
    source: require("../../assets/covers/sample-cover-tiny.jpg"),
    pixelWidth: 100,
    pixelHeight: 93,
    sizeBytes: 4045,
  },
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
