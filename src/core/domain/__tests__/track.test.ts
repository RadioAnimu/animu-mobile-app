import { describe, expect, it } from "vitest";
import type { Track } from "@/core/domain/track";
import {
  getTrackProgress,
  isFillerTransition,
  isRealTrack,
} from "@/core/domain/track";

const NOW = 1_800_000_000_000;

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
  startTime: new Date(NOW),
  playlistName: "",
  ...overrides,
});

describe("getTrackProgress", () => {
  it("returns elapsed ms for a running track", () => {
    const track = makeTrack({ startTime: new Date(NOW - 5_000) });
    expect(getTrackProgress(track, NOW)).toBe(5_000);
  });

  it("returns null before the track starts", () => {
    const track = makeTrack({ startTime: new Date(NOW + 5_000) });
    expect(getTrackProgress(track, NOW)).toBeNull();
  });

  it("returns null after the track ended", () => {
    const track = makeTrack({
      startTime: new Date(NOW - 61_000),
      duration: 60_000,
    });
    expect(getTrackProgress(track, NOW)).toBeNull();
  });

  it("returns null for invalid durations", () => {
    expect(getTrackProgress(makeTrack({ duration: 0 }), NOW)).toBeNull();
    expect(getTrackProgress(makeTrack({ duration: -1 }), NOW)).toBeNull();
    expect(getTrackProgress(undefined, NOW)).toBeNull();
  });
});

describe("isRealTrack", () => {
  it("accepts normal tracks", () => {
    expect(isRealTrack(makeTrack())).toBe(true);
  });

  it("filters jingles, transitions and self-promo (raw is the full line)", () => {
    expect(isRealTrack(makeTrack({ raw: "Rádio Animu - Animesong? | Haruka VHT" }))).toBe(
      false,
    );
    expect(
      isRealTrack(
        makeTrack({
          raw: "Rádio Animu - Nemukunai, a nossa comunidade sonora | Passagem Urahara",
        }),
      ),
    ).toBe(false);
    expect(isRealTrack(makeTrack({ artist: "Rádio Animu" }))).toBe(false);
    expect(isRealTrack(makeTrack({ anime: "Passagem Musical" }))).toBe(false);
  });

  it("rejects missing tracks", () => {
    expect(isRealTrack(null)).toBe(false);
    expect(isRealTrack(undefined)).toBe(false);
  });
});

describe("isFillerTransition", () => {
  it("flags 'passagem' beat transitions regardless of case", () => {
    expect(isFillerTransition({ anime: "Passagem Musical" })).toBe(true);
    expect(isFillerTransition({ anime: "passagem" })).toBe(true);
  });

  it("accepts real tracks", () => {
    expect(isFillerTransition({ anime: "Naruto" })).toBe(false);
  });

  it("treats a missing anime as not a filler transition", () => {
    expect(isFillerTransition(null)).toBe(false);
    expect(isFillerTransition(undefined)).toBe(false);
    expect(isFillerTransition({})).toBe(false);
  });
});
