import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArtworkResolver,
  pickPreviewArtwork,
} from "@/core/player/storage/artwork";
import type { Track } from "@/core/domain/track";

// Only `Platform` is read: the web build skips cover downloads.
const platform = vi.hoisted(() => ({ OS: "ios" }));
vi.mock("react-native", () => ({ Platform: platform }));

// expo-asset reaches react-native (unparseable in node) — mock it entirely.
// The bundled png is stubbed too; both are hoisted above the imports.
const assetMocks = vi.hoisted(() => ({
  fromModule: vi.fn(),
}));

// expo-file-system reaches react-native too. `directDownload` backs
// File.downloadFileAsync — it defaults to FAILING so the resolver takes
// the expo-asset fallback (what most of these tests assert); tests that
// cover the direct path re-set the implementation per case.
const fileSystemMocks = vi.hoisted(() => ({ directDownload: vi.fn() }));

// An in-memory cache dir: `File` instances are views on it by name, so a
// download into a `.part` file followed by `rename` behaves like the device.
const fileSystemState = vi.hoisted(() => ({ files: new Map<string, number>() }));

vi.mock("expo-file-system", () => {
  const files = fileSystemState.files;
  class File {
    constructor(_dir: unknown, public name: string) {}
    get uri(): string {
      return `file://mock/cache/${this.name}`;
    }
    get exists(): boolean {
      return files.has(this.name);
    }
    set exists(value: boolean) {
      if (value) files.set(this.name, files.get(this.name) ?? 0);
      else files.delete(this.name);
    }
    get size(): number {
      return files.get(this.name) ?? 0;
    }
    /** Write order stands in for the modification time. */
    get lastModified(): number {
      return [...files.keys()].indexOf(this.name);
    }
    set size(value: number) {
      files.set(this.name, value);
    }
    delete(): void {
      files.delete(this.name);
    }
    write(data: Uint8Array): void {
      files.set(this.name, data.length);
    }
    rename(newName: string): void {
      if (files.has(newName)) throw new Error("FileAlreadyExists");
      files.set(newName, files.get(this.name) ?? 0);
      files.delete(this.name);
      this.name = newName;
    }
    static downloadFileAsync = fileSystemMocks.directDownload;
  }
  class Directory {
    list(): File[] {
      return [...files.keys()].map((name) => new File(null, name));
    }
  }
  return { Directory, File, Paths: { cache: "file://mock/cache" } };
});

vi.mock("expo-asset", () => ({ Asset: assetMocks }));

// The fallback client (`expo/fetch`) — unavailable by default, like the direct one.
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("expo/fetch", () => ({ fetch: fetchMock }));
const coverResponse = (bytes = 128) => new Response(new Uint8Array(bytes));
/** A cover the resolver landed itself, by either client. */
const COVER_FILE = /^file:\/\/mock\/cache\/animu-cover-[0-9a-f]+\.jpg$/;
vi.mock("../../../../assets/default-cover.png", () => ({ default: 1234 }));
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
    expect(pickPreviewArtwork("https://cdn.test/trackImage1_large.jpg")).toBeNull();
    // Only a same-or-worse size reported → no smaller candidate exists.
    expect(
      pickPreviewArtwork("https://cdn.test/trackImage1_medium.jpg", {
        medium: "https://cdn.test/trackImage1_medium.jpg",
        large: "https://cdn.test/trackImage1_large.jpg",
      } as never),
    ).toBeNull();
  });
});

describe("ArtworkResolver", () => {
  beforeEach(() => {
    fileSystemState.files.clear();
    assetMocks.fromModule.mockReset();
    // Default: the direct download is unavailable → resolver uses the
    // fetch fallback (what most expectations target), itself failing unless
    // a test serves a cover.
    fileSystemMocks.directDownload
      .mockReset()
      .mockRejectedValue(new Error("direct download disabled in test"));
    fetchMock.mockReset().mockRejectedValue(new Error("fallback disabled in test"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
      fetchMock.mockResolvedValueOnce(coverResponse());

      const resolver = new ArtworkResolver();
      const local = await resolver.resolve("https://images.test/cover.png");

      expect(local).toMatch(COVER_FILE);
      expect(resolver.peek("https://images.test/cover.png")).toBe(local);
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
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ["https://images.test/cover.png", "animu-cover-29dde955.jpg"],
      ["https://images.test/🦊.png", "animu-cover-8f85bede.jpg"],
    ])("preserves existing cache file identity for %s", async (url, filename) => {
      fileSystemMocks.directDownload.mockImplementation(
        async (_url: string, file: { exists: boolean; size: number }) => {
          file.exists = true;
          file.size = 128;
        },
      );
      const resolver = new ArtworkResolver();
      expect(await resolver.resolve(url)).toBe(`file://mock/cache/${filename}`);
    });

    it("keeps the 64 newest downloaded covers, nothing else touched", async () => {
      const files = fileSystemState.files;
      for (let i = 0; i < 64; i++) files.set(`animu-cover-old${i}.jpg`, 10);
      files.set("someone-else.png", 10);
      files.set("animu-cover-busy.jpg.1-1.part", 10);
      fileSystemMocks.directDownload.mockImplementation(
        async (_url: string, file: { exists: boolean; size: number }) => {
          file.exists = true;
          file.size = 128;
        },
      );

      const local = await new ArtworkResolver().resolve("https://images.test/new.png");

      const covers = [...files.keys()].filter((name) => name.startsWith("animu-cover-") && !name.endsWith(".part"));
      expect(covers).toHaveLength(64);
      expect(files.has("animu-cover-old0.jpg")).toBe(false);
      expect(local).toMatch(/animu-cover-[0-9a-f]+\.jpg$/);
      expect(files.has("someone-else.png")).toBe(true);
      expect(files.has("animu-cover-busy.jpg.1-1.part")).toBe(true);
    });

    it("a wipe keeps only the shown cover, even with a newer one prefetched", async () => {
      fileSystemMocks.directDownload.mockImplementation(
        async (_url: string, file: { exists: boolean; size: number }) => {
          file.exists = true;
          file.size = 128;
        },
      );
      const resolver = new ArtworkResolver();
      const shown = await resolver.resolve("https://images.test/heard.png");
      await resolver.resolve("https://images.test/announced.png"); // newer file

      resolver.pruneDownloads(0, shown);

      expect(resolver.peek("https://images.test/heard.png")).toBe(shown);
      expect(resolver.peek("https://images.test/announced.png")).toBeUndefined();
      expect([...fileSystemState.files.keys()]).toEqual([shown.replace("file://mock/cache/", "")]);
    });

    it("after a wipe, re-fetches a shown cover the image cache held, and republishes it", async () => {
      let imageCacheFull = true;
      fetchMock.mockImplementation(async () => coverResponse());
      const resolver = new ArtworkResolver({
        findCachedCoverFile: async (url) =>
          imageCacheFull && url.includes("heard") ? "file://image-cache/heard.jpg" : null,
      });
      const republished: string[] = [];
      resolver.onLateResolve = (url) => republished.push(url);
      const heard = "https://images.test/heard.png";
      expect(await resolver.resolve(heard)).toBe("file://image-cache/heard.jpg");
      await resolver.resolve("https://images.test/other.png"); // a download, not shown

      imageCacheFull = false; // the wipe emptied the image cache
      resolver.afterCacheWipe(heard);

      expect(resolver.peek("https://images.test/other.png")).toBeUndefined();
      await vi.waitFor(() => expect(republished).toEqual([heard]));
      expect(resolver.peek(heard)).toMatch(COVER_FILE);
    });

    it("after a wipe, keeps a shown cover it downloaded itself", async () => {
      fetchMock.mockImplementation(async () => coverResponse());
      const resolver = new ArtworkResolver();
      const republished: string[] = [];
      resolver.onLateResolve = (url) => republished.push(url);
      const heard = "https://images.test/heard.png";
      const shown = await resolver.resolve(heard);

      resolver.afterCacheWipe(heard);

      expect(resolver.peek(heard)).toBe(shown);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(republished).toEqual([]);
    });

    it("shares one download between concurrent callers", async () => {
      fetchMock.mockResolvedValueOnce(coverResponse());

      const resolver = new ArtworkResolver();
      const [a, b] = await Promise.all([
        resolver.resolve("https://images.test/cover.png"),
        resolver.resolve("https://images.test/cover.png"),
      ]);

      expect(a).toBe(b);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("degrades to the remote URL when the download fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("offline"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const resolver = new ArtworkResolver();
      const url = "https://images.test/cover.png";
      expect(await resolver.resolve(url)).toBe(url);
      expect(resolver.peek(url)).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("never exposes a half-written download under the cover's file name", async () => {
      let finish!: () => void;
      fileSystemMocks.directDownload.mockImplementation(
        (_url: string, file: { size: number }) => {
          file.size = 4096; // bytes arriving…
          return new Promise<void>((resolve) => {
            finish = () => {
              file.size = 120540;
              resolve();
            };
          });
        },
      );

      const resolver = new ArtworkResolver();
      const pending = resolver.resolve("https://images.test/cover.png");
      await vi.waitFor(() => expect(fileSystemMocks.directDownload).toHaveBeenCalled());

      // Mid-transfer only the private part file exists: a second lookup (the
      // adoption after a prefetch gave up) cannot take it for a done cover.
      const names = [...fileSystemState.files.keys()];
      expect(names).toHaveLength(1);
      expect(names[0]).toMatch(/^animu-cover-[0-9a-f]+\.jpg\..+\.part$/);

      finish();
      const local = await pending;
      expect([...fileSystemState.files.keys()]).toEqual([
        local.replace("file://mock/cache/", ""),
      ]);
      expect(fileSystemState.files.get(local.replace("file://mock/cache/", ""))).toBe(120540);
    });

    it("adopts a download that lands after its resolve gave up, and says so", async () => {
      vi.useFakeTimers();
      let finish!: () => void;
      fileSystemMocks.directDownload.mockImplementation(
        (_url: string, file: { size: number }) =>
          new Promise<void>((resolve) => {
            finish = () => {
              file.size = 120540;
              resolve();
            };
          }),
      );
      fetchMock.mockReturnValue(new Promise(() => {})); // fallback hangs too
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const resolver = new ArtworkResolver();
      const late: string[] = [];
      resolver.onLateResolve = (lateUrl) => late.push(lateUrl);
      const url = "https://images.test/cover.png";

      const pending = resolver.resolve(url);
      await vi.advanceTimersByTimeAsync(10_000); // both deadlines
      expect(await pending).toBe(url);
      expect(resolver.peek(url)).toBeUndefined();
      expect(late).toEqual([]);

      finish();
      await vi.advanceTimersByTimeAsync(0);

      expect(resolver.peek(url)).toMatch(/^file:\/\/mock\/cache\/animu-cover-[0-9a-f]+\.jpg$/);
      expect(late).toEqual([url]);
    });

    it.each([
      ["direct first", ["direct", "fallback"]],
      ["fallback first", ["fallback", "direct"]],
    ] as const)("lands one cover when both clients finish late (%s)", async (_label, order) => {
      vi.useFakeTimers();
      const finish: Record<"direct" | "fallback", () => void> = { direct: () => {}, fallback: () => {} };
      fileSystemMocks.directDownload.mockImplementation(
        (_url: string, file: { size: number }) =>
          new Promise<void>((resolve) => {
            finish.direct = () => {
              file.size = 120540;
              resolve();
            };
          }),
      );
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          finish.fallback = () => resolve(coverResponse(120540));
        }),
      );
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const resolver = new ArtworkResolver();
      const late: string[] = [];
      resolver.onLateResolve = (lateUrl) => late.push(lateUrl);
      const url = "https://images.test/cover.png";
      const pending = resolver.resolve(url);
      await vi.advanceTimersByTimeAsync(10_000); // both deadlines
      await pending;
      for (const client of order) {
        finish[client]();
        await vi.advanceTimersByTimeAsync(0);
      }

      expect([...fileSystemState.files.keys()]).toEqual([expect.stringMatching(/^animu-cover-[0-9a-f]+\.jpg$/)]);
      expect(fileSystemState.files.values().next().value).toBe(120540);
      expect(resolver.peek(url)).toMatch(COVER_FILE);
      expect(late).toEqual([url]);
    });

    it("caps the folder for a download that lands after its deadline too", async () => {
      vi.useFakeTimers();
      for (let i = 0; i < 64; i++) fileSystemState.files.set(`animu-cover-old${i}.jpg`, 10);
      let finish!: () => void;
      fileSystemMocks.directDownload.mockImplementation(
        (_url: string, file: { size: number }) =>
          new Promise<void>((resolve) => {
            finish = () => {
              file.size = 120540;
              resolve();
            };
          }),
      );
      fetchMock.mockReturnValue(new Promise(() => {}));
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const pending = new ArtworkResolver().resolve("https://images.test/late.png");
      await vi.advanceTimersByTimeAsync(10_000); // both deadlines
      await pending;
      finish();
      await vi.advanceTimersByTimeAsync(0);

      expect(fileSystemState.files.size).toBe(64); // no part file left behind
      expect(fileSystemState.files.has("animu-cover-old0.jpg")).toBe(false);
    });

    it("does not announce a download that landed in time", async () => {
      fileSystemMocks.directDownload.mockImplementation(
        async (_url: string, file: { size: number }) => {
          file.size = 120540;
        },
      );
      const resolver = new ArtworkResolver();
      const late: string[] = [];
      resolver.onLateResolve = (lateUrl) => late.push(lateUrl);

      const local = await resolver.resolve("https://images.test/cover.png");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(resolver.peek("https://images.test/cover.png")).toBe(local);
      expect(late).toEqual([]);
    });

    it("passes non-remote URLs through untouched", async () => {
      const resolver = new ArtworkResolver();
      expect(await resolver.resolve("file://already-local.png")).toBe(
        "file://already-local.png",
      );
      expect(fetchMock).not.toHaveBeenCalled();
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
      expect(fetchMock).not.toHaveBeenCalled();
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
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("seeds the downloaded file back into the image cache", async () => {
      const onResolved = vi.fn(async () => {});
      fetchMock.mockResolvedValueOnce(coverResponse());

      const resolver = new ArtworkResolver({ onResolved });
      await resolver.resolve("https://images.test/cover.png");

      expect(onResolved).toHaveBeenCalledWith(
        expect.stringMatching(COVER_FILE),
        "https://images.test/cover.png",
      );
    });

    it("does not seed when the download degraded to the remote URL", async () => {
      const onResolved = vi.fn(async () => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const resolver = new ArtworkResolver({ onResolved });
      await resolver.resolve("https://images.test/cover.png");

      expect(onResolved).not.toHaveBeenCalled();
    });

    it("a failed cache probe degrades to the download path", async () => {
      fetchMock.mockResolvedValueOnce(coverResponse());

      const resolver = new ArtworkResolver({
        findCachedCoverFile: async () => null,
      });
      const local = await resolver.resolve("https://images.test/cover.png");

      expect(local).toMatch(COVER_FILE);
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("resolve() — progressive preview", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("wires the low-res preview even when the full download is already in flight", async () => {
      const fullUrl = "https://images.test/trackImage1_large.jpg";
      const previewUrl = "https://images.test/trackImage1_tiny.jpg";

      let releaseFull!: (value: Response) => void;
      fetchMock.mockReturnValueOnce(
        new Promise((resolve) => {
          releaseFull = resolve;
        }),
      );

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
      releaseFull(coverResponse());
      const full = await prefetch;
      expect(full).toMatch(COVER_FILE);
      expect(await adoption).toBe(full);
      expect(resolver.peek(fullUrl)).toBe(full);
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
    it("does not pin the full URL to its preview when the full download fails", async () => {
      const fullUrl = "https://images.test/trackImage1_large.jpg";
      const previewUrl = "https://images.test/trackImage1.jpg";
      // The full download fails (both the direct path and the fallback).
      fetchMock.mockRejectedValue(new Error("deadline"));

      const resolver = new ArtworkResolver({
        findCachedCoverFile: async (url) =>
          url === previewUrl ? "file://image-cache/tiny.jpg" : null,
      });

      const previews: string[] = [];
      const result = await resolver.resolve(
        fullUrl,
        (local) => previews.push(local),
        previewUrl,
      );
      await flush();

      // The preview painted, the full failed → the caller falls back to the
      // remote URL...
      expect(previews).toEqual(["file://image-cache/tiny.jpg"]);
      expect(result).toBe(fullUrl);
      // ...and the low-res preview must not stay mapped as the full cover:
      // every later lookup (apply(), peek, a retry) would serve 100px.
      expect(resolver.peek(fullUrl)).toBeUndefined();
    });

    it("ignores a preview that lands after the full download already failed", async () => {
      const fullUrl = "https://images.test/trackImage1_large.jpg";
      const previewUrl = "https://images.test/trackImage1.jpg";
      fetchMock.mockRejectedValue(new Error("deadline"));

      let releasePreview!: (value: string) => void;
      const resolver = new ArtworkResolver({
        findCachedCoverFile: (url) =>
          url === previewUrl
            ? new Promise<string | null>((resolve) => {
                releasePreview = resolve;
              })
            : Promise.resolve(null),
      });

      const previews: string[] = [];
      expect(
        await resolver.resolve(fullUrl, (local) => previews.push(local), previewUrl),
      ).toBe(fullUrl);

      releasePreview("file://image-cache/tiny.jpg");
      await flush();

      expect(previews).toEqual([]);
      expect(resolver.peek(fullUrl)).toBeUndefined();
    });
  });

  describe("apply()", () => {
    it("swaps the track artwork to the local file once resolved", async () => {
      fetchMock.mockResolvedValueOnce(coverResponse());

      const resolver = new ArtworkResolver();
      const track = makeTrack();

      // Before the download: the track passes through untouched
      expect(resolver.apply(track)).toBe(track);

      await resolver.resolve(track.artwork as string);
      const applied = resolver.apply(track);
      expect(applied).not.toBe(track);
      expect(applied?.artwork).toMatch(COVER_FILE);
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

describe("ArtworkResolver on web", () => {
  afterEach(() => {
    platform.OS = "ios";
    vi.resetModules();
  });

  it("hands covers to the browser by URL, downloading nothing", async () => {
    platform.OS = "web";
    vi.resetModules();
    const { ArtworkResolver: WebResolver } = await import("@/core/player/storage/artwork");
    const resolver = new WebResolver();
    const url = "https://images.test/cover.png";

    expect(resolver.isRemote(url)).toBe(false);
    expect(await resolver.resolve(url)).toBe(url);
    expect(fileSystemMocks.directDownload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
