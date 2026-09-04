import { describe, expect, it } from "vitest";
import type { Track } from "../../domain/track";
import { buildNowPlayingMetadata } from "../now-playing.metadata";

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "1",
  raw: "Artist - Title",
  title: "Title",
  artist: "Artist",
  anime: "Naruto",
  artworks: {},
  artwork: "https://example.com/cover.jpg",
  duration: 90_000,
  isRequest: false,
  startTime: new Date(0),
  ...overrides,
});

describe("buildNowPlayingMetadata", () => {
  it("maps a track with the anime as title (legacy behavior)", () => {
    const metadata = buildNowPlayingMetadata({
      track: makeTrack(),
      isLive: false,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata).toEqual({
      title: "Naruto",
      artist: "Artist",
      artwork: "https://example.com/cover.jpg",
      isLiveStream: false,
    });
  });

  it("falls back to defaults without a track", () => {
    const metadata = buildNowPlayingMetadata({
      track: null,
      isLive: true,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata).toEqual({
      title: "N/A",
      artist: "N/A",
      artwork: "cover.png",
      isLiveStream: true,
    });
  });

  it("adds durationSec only when progress is shown and duration is valid", () => {
    const base = {
      isLive: false,
      defaultCover: "cover.png",
    };

    const withProgress = buildNowPlayingMetadata({
      ...base,
      track: makeTrack({ duration: 90_000 }),
      showProgress: true,
    });
    expect(withProgress.durationSec).toBe(90);

    const hidden = buildNowPlayingMetadata({
      ...base,
      track: makeTrack({ duration: 90_000 }),
      showProgress: false,
    });
    expect(hidden.durationSec).toBeUndefined();

    const zeroDuration = buildNowPlayingMetadata({
      ...base,
      track: makeTrack({ duration: 0 }),
      showProgress: true,
    });
    expect(zeroDuration.durationSec).toBeUndefined();
  });

  it("uses the default cover when the track has none", () => {
    const metadata = buildNowPlayingMetadata({
      track: makeTrack({ artwork: "" }),
      isLive: false,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata.artwork).toBe("cover.png");
  });
});
