import { describe, expect, it } from "vitest";
import { elapsedFromStart, getElapsedMs, trackStartMs } from "../clock";
import type { Track } from "../../domain/track";

const makeTrack = (overrides: Partial<Track> = {}): Track =>
  ({
    id: "1",
    raw: "Artist - Title | Anime",
    title: "Title",
    artist: "Artist",
    anime: "Anime",
    artworks: {},
    artwork: "https://example.com/cover.png",
    duration: 200_000,
    isRequest: false,
    startTime: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }) as Track;

const NOW = Date.parse("2026-01-01T00:01:30.000Z");

describe("trackStartMs", () => {
  it("reads the epoch ms", () => {
    expect(trackStartMs(makeTrack())).toBe(
      Date.parse("2026-01-01T00:00:00.000Z"),
    );
  });

  it("rejects unusable stamps", () => {
    expect(trackStartMs(undefined)).toBeNull();
    expect(trackStartMs(makeTrack({ startTime: new Date(NaN) }))).toBeNull();
  });
});

describe("elapsed math", () => {
  it("derives elapsed from the wall clock (no drift)", () => {
    expect(getElapsedMs(makeTrack(), NOW)).toBe(90_000);
    expect(elapsedFromStart(Date.parse("2026-01-01T00:00:00.000Z"), NOW)).toBe(
      90_000,
    );
  });

  it("returns null while the start stamp is still in the future (clock skew)", () => {
    expect(getElapsedMs(makeTrack(), NOW - 120_000)).toBeNull();
    expect(elapsedFromStart(NOW + 5_000, NOW)).toBeNull();
  });

  it("keeps counting past the track end (last line stays highlighted)", () => {
    expect(getElapsedMs(makeTrack(), NOW + 120_000)).toBe(210_000);
  });
});
