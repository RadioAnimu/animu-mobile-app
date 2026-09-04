import { describe, expect, it } from "vitest";
import type { Track } from "../track";
import { getTrackProgress, isRealTrack } from "../track";

const makeTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "1",
  raw: "raw",
  title: "Title",
  artist: "Artist",
  anime: "Naruto",
  artworks: {},
  artwork: "cover.jpg",
  duration: 60_000,
  isRequest: false,
  startTime: new Date(),
  ...overrides,
});

describe("getTrackProgress", () => {
  it("returns elapsed ms for a running track", () => {
    const track = makeTrack({ startTime: new Date(Date.now() - 5_000) });
    const progress = getTrackProgress(track);
    expect(progress).toBeGreaterThanOrEqual(4_999);
    expect(progress).toBeLessThan(5_100);
  });

  it("returns null before the track starts", () => {
    const track = makeTrack({ startTime: new Date(Date.now() + 5_000) });
    expect(getTrackProgress(track)).toBeNull();
  });

  it("returns null after the track ended", () => {
    const track = makeTrack({
      startTime: new Date(Date.now() - 61_000),
      duration: 60_000,
    });
    expect(getTrackProgress(track)).toBeNull();
  });

  it("returns null for invalid durations", () => {
    expect(getTrackProgress(makeTrack({ duration: 0 }))).toBeNull();
    expect(getTrackProgress(makeTrack({ duration: -1 }))).toBeNull();
    expect(getTrackProgress(undefined)).toBeNull();
  });
});

describe("isRealTrack", () => {
  it("accepts normal tracks", () => {
    expect(isRealTrack(makeTrack())).toBe(true);
  });

  it("filters jingles, transitions and self-promo", () => {
    expect(isRealTrack(makeTrack({ anime: "Passagem Musical" }))).toBe(false);
    expect(isRealTrack(makeTrack({ artist: "Rádio Animu" }))).toBe(false);
    expect(isRealTrack(makeTrack({ anime: "Animu Delivery" }))).toBe(false);
  });

  it("rejects missing tracks", () => {
    expect(isRealTrack(null)).toBe(false);
    expect(isRealTrack(undefined)).toBe(false);
  });
});
