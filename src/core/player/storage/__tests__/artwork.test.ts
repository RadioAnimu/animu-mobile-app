import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArtworkResolver,
  pickPreviewArtwork,
} from "@/core/player/storage/artwork";
import type { Track } from "@/core/domain/track";

// expo-asset reaches react-native (unparseable in node) — mock it entirely.
// The bundled png is stubbed too; both are hoisted above the imports.
const assetMocks = vi.hoisted(() => ({
  fromModule: vi.fn(),
  fromURI: vi.fn(),
}));

// expo-file-system reaches react-native too. `directDownload` backs
// File.downloadFileAsync — it defaults to FAILING so the resolver takes
// the expo-asset fallback (what most of these tests assert); tests that
// cover the direct path re-set the implementation per case.
const fileSystemMocks = vi.hoisted(() => ({ directDownload: vi.fn() }));

vi.mock("expo-file-system", () => {
  const File = Object.assign(
    function (this: { exists: boolean; size: number; uri: string }, dir: unknown, name: string) {
      void dir;
      this.exists = false;
      this.size = 0;
      this.uri = `file://mock/cache/${name}`;
    },
    {
      downloadFileAsync: fileSystemMocks.directDownload,
    },
  ) as unknown as {
    new (dir: unknown, name: string): {
      exists: boolean;
      size: number;
      uri: string;
    };
  };
  return { File, Paths: { cache: "file://mock/cache" } };
});

vi.mock("expo-asset", () => ({ Asset: assetMocks }));
vi.mock("../../../assets/default-cover.png", () => ({ default: 1234 }));
// cover-image-cache (imported for the slash-normalized keys) reaches
// expo-image at module scope.
vi.mock("expo-image", () => ({
  Image: { getCachePathAsync: vi.fn(), writeToCacheAsync: vi.fn() },
}));

const makeTrack = (artwork = "https://images.test/cover.png"): Track =>
  ({
    raw: "Artist - Title",
    artwork,
    duration: 100_000,
    startTime: new Date(),
  }) as unknown as Track;

describe("pickPreviewArtwork", () => {
  it("picks the lowest reported size strictly below the requested one", () => {
    expect(
      pickPreviewArtwork("https://cdn.test/trackImage1_large.jpg", {
        tiny: "https://cdn.test/trackImage1_tiny.jpg",
        medium: "https://cdn.test/trackImage1_medium.jpg",
        large: "https://cdn.test/trackImage1_large.jpg",
      }),
    ).toBe("https://cdn.test/trackImage1_tiny.jpg");
    expect(
      pickPreviewArtwork("https://cdn.test/trackImage1_medium.jpg", {
        tiny: "https://cdn.test/trackImage1_tiny.jpg",
        medium: "https://cdn.test/trackImage1_medium.jpg",
      }),
    ).toBe("https://cdn.test/trackImage1_tiny.jpg");
  });

  it("never picks a size the API did not report (the CDN 302s unknown sizes to a placeholder)", () => {
    // No artworks report → no preview at all, even though the naming
    // scheme could "derive" a `_tiny` URL.
    expect(pickPreviewArtwork("https://cdn.test/trackImage1_large.jpg")).toBe(
      null,
    );
    // Only a same-or-worse size reported → no smaller candidate exists.
    expect(
      pickPreviewArtwork("https://cdn.test/trackImage1_medium.jpg", {
        medium: "https://cdn.test/trackImage1_medium.jpg",
        large: "https://cdn.test/trackImage1_large.jpg",
      } as never),
    ).toBe(null);
  });
});

describe("ArtworkResolver", () => {
  beforeEach(() => {
    assetMocks.fromModule.mockReset();
    assetMocks.fromURI.mockReset();
    // Default: the direct download is unavailable → resolver uses the
    // expo-asset fallback path (what the existing expectations target).
    fileSystemMocks.directDownload
      .mockReset()
      .mockRejectedValue(new Error("direct download disabled in test"));
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

    it("downloads directly to a deterministic cache file (no expo-asset machinery)", async () => {
      // Direct path available: expo-asset must stay untouched.
      fileSystemMocks.directDownload.mockImplementation(
        async (_url: string, file: { exists: boolean; size: number }) => {
          file.exists = true;
          file.size = 120540;
        },
      );

      const resolver = new ArtworkResolver();
      const url = "https://images.test/cover.png";
      const local = await resolver.resolve(url);

      expect(fileSystemMocks.directDownload).toHaveBeenCalledTimes(1);
      expect(fileSystemMocks.directDownload).toHaveBeenCalledWith(
        url,
        expect.any(Object),
      );
      expect(local).toBe(resolver.peek(url));
      expect(local).toMatch(/^file:\/\/mock\/cache\/animu-cover-[0-9a-f]+\.jpg$/);
      expect(assetMocks.fromURI).not.toHaveBeenCalled();
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

  describe("resolve() — disk-cache ladder", () => {
    it("reuses a cached copy from an earlier journey instead of downloading", async () => {
      const resolver = new ArtworkResolver({
        findCachedCoverFile: async () => "file://image-cache/same.png",
      });

      const local = await resolver.resolve("https://images.test/cover.png");

      expect(local).toBe("file://image-cache/same.png");
      expect(resolver.peek("https://images.test/cover.png")).toBe(
        "file://image-cache/same.png",
      );
      expect(assetMocks.fromURI).not.toHaveBeenCalled();
    });

    it("shares one cache probe between concurrent callers (no double probe)", async () => {
      const findCached = vi.fn(async () => "file://image-cache/slow.png");
      const resolver = new ArtworkResolver({
        findCachedCoverFile: findCached,
      });

      const [a, b] = await Promise.all([
        resolver.resolve("https://images.test/cover.png"),
        resolver.resolve("https://images.test/cover.png"),
      ]);

      expect(findCached).toHaveBeenCalledTimes(1);
      expect(a).toBe("file://image-cache/slow.png");
      expect(b).toBe("file://image-cache/slow.png");
      expect(assetMocks.fromURI).not.toHaveBeenCalled();
    });

    it("seeds the downloaded file back into the image cache", async () => {
      const onResolved = vi.fn(async () => {});
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: "file://cache/cover.png",
        downloadAsync: async () => ({ localUri: "file://cache/cover.png" }),
      });

      const resolver = new ArtworkResolver({ onResolved });
      await resolver.resolve("https://images.test/cover.png");

      expect(onResolved).toHaveBeenCalledWith(
        "file://cache/cover.png",
        "https://images.test/cover.png",
      );
    });

    it("does not seed when the download degraded to the remote URL", async () => {
      const onResolved = vi.fn(async () => {});
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: null,
        downloadAsync: async () => ({ localUri: null }),
      });

      const resolver = new ArtworkResolver({ onResolved });
      await resolver.resolve("https://images.test/cover.png");

      expect(onResolved).not.toHaveBeenCalled();
    });

    it("a failed cache probe degrades to the download path", async () => {
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: "file://cache/cover.png",
        downloadAsync: async () => ({ localUri: "file://cache/cover.png" }),
      });

      const resolver = new ArtworkResolver({
        findCachedCoverFile: async () => null,
      });
      const local = await resolver.resolve("https://images.test/cover.png");

      expect(local).toBe("file://cache/cover.png");
      expect(assetMocks.fromURI).toHaveBeenCalledOnce();
    });
  });

  describe("resolve() — progressive preview", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("wires the low-res preview even when the full download is already in flight", async () => {
      const fullUrl = "https://images.test/trackImage1_large.jpg";
      const previewUrl = "https://images.test/trackImage1_tiny.jpg";

      let releaseFull!: (value: { localUri: string }) => void;
      assetMocks.fromURI.mockReturnValueOnce({
        localUri: null,
        downloadAsync: () =>
          new Promise((resolve) => {
            releaseFull = resolve;
          }),
      });

      const resolver = new ArtworkResolver({
        findCachedCoverFile: async (url) =>
          url === previewUrl ? "file://image-cache/tiny.jpg" : null,
      });

      // A prefetch grabs the full-size download slot…
      const prefetch = resolver.resolve(fullUrl);
      await flush();

      // …and the adoption call must STILL paint the tiny from cache and map
      // it onto the full URL while the full is missing.
      const previews: string[] = [];
      const adoption = resolver.resolve(fullUrl, (local) =>
        previews.push(local),
        previewUrl,
      );
      await flush();

      expect(previews).toEqual(["file://image-cache/tiny.jpg"]);
      expect(resolver.peek(fullUrl)).toBe("file://image-cache/tiny.jpg");

      // The full lands and wins.
      releaseFull({ localUri: "file://cache/full.jpg" });
      expect(await prefetch).toBe("file://cache/full.jpg");
      expect(await adoption).toBe("file://cache/full.jpg");
      expect(resolver.peek(fullUrl)).toBe("file://cache/full.jpg");
    });

    it("issues the preview and full downloads in parallel", async () => {
      const fullUrl = "https://images.test/trackImage1_large.jpg";
      const previewUrl = "https://images.test/trackImage1_tiny.jpg";

      const probeOrder: string[] = [];
      const releases: Record<string, () => void> = {};

      const resolver = new ArtworkResolver({
        // Hold each probe open so we can prove both were issued before
        // either resolved (i.e. the downloads are concurrent).
        findCachedCoverFile: (url) =>
          new Promise<string | null>((resolve) => {
            probeOrder.push(url);
            releases[url] = () =>
              resolve(
                url === previewUrl
                  ? "file://image-cache/tiny.jpg"
                  : "file://image-cache/full.jpg",
              );
          }),
      });

      const done = resolver.resolve(fullUrl, () => {}, previewUrl);
      await flush();

      expect(probeOrder).toEqual([previewUrl, fullUrl]);

      Object.values(releases).forEach((release) => release());
      await flush();

      expect(await done).toBe("file://image-cache/full.jpg");
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
