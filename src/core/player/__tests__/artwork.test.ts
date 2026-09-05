import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtworkResolver } from "../artwork";
import type { Track } from "../../domain/track";

// expo-asset reaches react-native (unparseable in node) — mock it entirely.
// The bundled png is stubbed too; both are hoisted above the imports.
const assetMocks = vi.hoisted(() => ({
  fromModule: vi.fn(),
  fromURI: vi.fn(),
}));

vi.mock("expo-asset", () => ({ Asset: assetMocks }));
vi.mock("../../../assets/default-cover.png", () => ({ default: 1234 }));

const makeTrack = (artwork = "https://images.test/cover.png"): Track =>
  ({
    raw: "Artist - Title",
    artwork,
    duration: 100_000,
    startTime: new Date(),
  }) as unknown as Track;

describe("ArtworkResolver", () => {
  beforeEach(() => {
    assetMocks.fromModule.mockReset();
    assetMocks.fromURI.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("default cover", () => {
    it("falls back to the remote URL until init() resolves the bundled asset", async () => {
      assetMocks.fromModule.mockReturnValueOnce({
        localUri: null,
        downloadAsync: async () => ({ localUri: "file://bundled.png" }),
      });

      const resolver = new ArtworkResolver();
      expect(resolver.defaultCover).toContain("https://"); // remote default

      await resolver.init();
      expect(resolver.defaultCover).toBe("file://bundled.png");
    });

    it("init() is idempotent and survives a failure (keeps the remote URL)", async () => {
      const download = vi
        .fn<() => Promise<{ localUri: string | null }>>()
        .mockRejectedValueOnce(new Error("no bundle"))
        .mockRejectedValueOnce(new Error("no bundle"));
      assetMocks.fromModule.mockReturnValueOnce({
        localUri: null,
        downloadAsync: download,
      });

      const resolver = new ArtworkResolver();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await resolver.init();
      expect(resolver.defaultCover).not.toBe("file://bundled.png");

      await resolver.init();
      // One bundled-asset attempt for both calls — the failure is cached
      expect(download).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("resolve()", () => {
    it("downloads a remote cover and resolves to the local file URI", async () => {
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: "file://cache/cover.png",
        downloadAsync: async () => ({ localUri: "file://cache/cover.png" }),
      });

      const resolver = new ArtworkResolver();
      const local = await resolver.resolve("https://images.test/cover.png");

      expect(local).toBe("file://cache/cover.png");
      expect(resolver.peek("https://images.test/cover.png")).toBe(
        "file://cache/cover.png",
      );
    });

    it("shares one download between concurrent callers", async () => {
      const downloadAsync = vi.fn(async () => ({
        localUri: "file://cache/cover.png",
      }));
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: null,
        downloadAsync,
      });

      const resolver = new ArtworkResolver();
      const [a, b] = await Promise.all([
        resolver.resolve("https://images.test/cover.png"),
        resolver.resolve("https://images.test/cover.png"),
      ]);

      expect(a).toBe(b);
      expect(downloadAsync).toHaveBeenCalledTimes(1);
    });

    it("degrades to the remote URL when the download fails", async () => {
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: null,
        downloadAsync: async () => {
          throw new Error("offline");
        },
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const resolver = new ArtworkResolver();
      const url = "https://images.test/cover.png";
      expect(await resolver.resolve(url)).toBe(url);
      expect(resolver.peek(url)).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("passes non-remote URLs through untouched", async () => {
      const resolver = new ArtworkResolver();
      expect(await resolver.resolve("file://already-local.png")).toBe(
        "file://already-local.png",
      );
      expect(assetMocks.fromURI).not.toHaveBeenCalled();
    });
  });

  describe("apply()", () => {
    it("swaps the track artwork to the local file once resolved", async () => {
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: "file://cache/cover.png",
        downloadAsync: async () => ({ localUri: "file://cache/cover.png" }),
      });

      const resolver = new ArtworkResolver();
      const track = makeTrack();

      // Before the download: the track passes through untouched
      expect(resolver.apply(track)).toBe(track);

      await resolver.resolve(track.artwork as string);
      const applied = resolver.apply(track);
      expect(applied).not.toBe(track);
      expect(applied?.artwork).toBe("file://cache/cover.png");
      // Everything else is preserved (same Date instance, shallow spread)
      expect(applied?.startTime).toBe(track.startTime);
    });

    it("passes tracks without artwork through untouched", () => {
      const resolver = new ArtworkResolver();
      expect(resolver.apply(null)).toBeNull();
      expect(resolver.apply(undefined)).toBeUndefined();
    });
  });

  describe("isRemote()", () => {
    it("treats http(s) URLs as needing a download", () => {
      const resolver = new ArtworkResolver();
      expect(resolver.isRemote("https://images.test/cover.png")).toBe(true);
      expect(resolver.isRemote("http://images.test/cover.png")).toBe(true);
    });

    it("treats already-local URIs as final", () => {
      const resolver = new ArtworkResolver();
      expect(resolver.isRemote("file://cache/cover.png")).toBe(false);
      expect(resolver.isRemote("content://media/cover")).toBe(false);
    });
  });

  it("reset() drops the lookups but keeps the resolved default cover", async () => {
    assetMocks.fromModule.mockReturnValueOnce({
      localUri: "file://bundled.png",
      downloadAsync: async () => ({ localUri: "file://bundled.png" }),
    });

    const resolver = new ArtworkResolver();
    await resolver.init();
    resolver.reset();

    expect(resolver.defaultCover).toBe("file://bundled.png");
    expect(resolver.peek("https://images.test/cover.png")).toBeUndefined();
  });
});
