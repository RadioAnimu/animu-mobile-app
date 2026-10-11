import { describe, expect, it } from "vitest";
import type { Track } from "@/core/domain/track";
import { buildNowPlayingMetadata } from "@/core/player/media-session/now-playing.metadata";

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
  playlistName: "",
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

  it("names the station without a track", () => {
    const metadata = buildNowPlayingMetadata({
      track: null,
      isLive: true,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata).toEqual({
      title: "Rádio Animu",
      artist: "",
      artwork: "cover.png",
      isLiveStream: true,
    });
  });

  it("promotes the song to the title for a song from no anime (Value by Ado)", () => {
    const metadata = buildNowPlayingMetadata({
      track: makeTrack({ raw: "Ado - Value", title: "Value", artist: "Ado", anime: "" }),
      isLive: false,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata).toMatchObject({ title: "Value", artist: "Ado" });
  });

  it("shows the song as the second line when the artist is missing", () => {
    const metadata = buildNowPlayingMetadata({
      track: makeTrack({ raw: "Just A Title | Naruto", title: "Just A Title", artist: "" }),
      isLive: false,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata).toMatchObject({ title: "Naruto", artist: "Just A Title" });
  });

  it("never shows a placeholder for a bare title", () => {
    const metadata = buildNowPlayingMetadata({
      track: makeTrack({ raw: "Passagem", title: "Passagem", artist: "", anime: "" }),
      isLive: false,
      showProgress: false,
      defaultCover: "cover.png",
    });

    expect(metadata).toMatchObject({ title: "Passagem", artist: "" });
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
