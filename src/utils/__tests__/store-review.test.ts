// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_STORE_LINKS,
  resolveInstallSource,
} from "@/utils/store-review";

const mocks = vi.hoisted(() => ({
  getInstallReferrerAsync: vi.fn(),
  getIosApplicationReleaseTypeAsync: vi.fn(),
  fetch: vi.fn(),
  platformOS: "android" as "android" | "ios",
}));

// A getter so each test can switch the platform before calling the resolver.
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));
vi.mock("expo-application", () => ({
  ApplicationReleaseType: {
    APP_STORE: 0,
    AD_HOC: 1,
    DEVELOPMENT: 2,
    SIMULATOR: 3,
    ENTERPRISE: 4,
    UNKNOWN: 5,
  },
  getInstallReferrerAsync: mocks.getInstallReferrerAsync,
  getIosApplicationReleaseTypeAsync: mocks.getIosApplicationReleaseTypeAsync,
}));

const storeReview = async () =>
  (await import("@/utils/store-review")) as typeof import("@/utils/store-review");

const RESPONSE = (payload: unknown, ok = true) =>
  ({ ok, json: async () => payload }) as Response;

/** Store list from the endpoint: the merged-over shape. */
const REMOTE_STORES = {
  version: 1,
  stores: {
    play: { ...DEFAULT_STORE_LINKS.play, name: "Play Store" },
    "app-store": { ...DEFAULT_STORE_LINKS["app-store"], url: "https://apps.test/animu" },
    altstore: DEFAULT_STORE_LINKS.altstore,
    apk: { ...DEFAULT_STORE_LINKS.apk },
  },
};

beforeEach(() => {
  // resetAllMocks also drains the `mockResolvedValueOnce` queues, which must
  // not leak into the next test's call order.
  vi.resetAllMocks();
  mocks.platformOS = "android";
  mocks.getInstallReferrerAsync.mockResolvedValue(null);
  mocks.getIosApplicationReleaseTypeAsync.mockResolvedValue(0);
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("resolveInstallSource — Android", () => {
  it("reads a non-empty Play referrer as play", async () => {
    mocks.getInstallReferrerAsync.mockResolvedValueOnce(
      "utm_source=google-play&utm_medium=organic",
    );
    await expect(resolveInstallSource()).resolves.toBe("play");
  });

  it("treats an empty referrer or a failed read as apk", async () => {
    mocks.getInstallReferrerAsync
      .mockResolvedValueOnce("")
      .mockRejectedValueOnce(new Error("no Play services"));
    await expect(resolveInstallSource()).resolves.toBe("apk");
    await expect(resolveInstallSource()).resolves.toBe("apk");
  });
});

describe("resolveInstallSource — iOS", () => {
  it("maps the release type to the store it came from", async () => {
    mocks.platformOS = "ios";
    const { APP_STORE, AD_HOC, DEVELOPMENT, SIMULATOR, ENTERPRISE, UNKNOWN } = (
      await import("expo-application")
    ).ApplicationReleaseType;
    mocks.getIosApplicationReleaseTypeAsync
      .mockResolvedValueOnce(APP_STORE)
      .mockResolvedValueOnce(SIMULATOR)
      .mockResolvedValueOnce(UNKNOWN)
      .mockResolvedValueOnce(AD_HOC)
      .mockResolvedValueOnce(DEVELOPMENT)
      .mockResolvedValueOnce(ENTERPRISE)
      // The read itself failing is still an App Store build, best-effort.
      .mockRejectedValueOnce(new Error("not on this iOS"));
    await expect(resolveInstallSource()).resolves.toBe("app-store");
    await expect(resolveInstallSource()).resolves.toBe("app-store");
    await expect(resolveInstallSource()).resolves.toBe("app-store");
    await expect(resolveInstallSource()).resolves.toBe("altstore");
    await expect(resolveInstallSource()).resolves.toBe("altstore");
    await expect(resolveInstallSource()).resolves.toBe("altstore");
    await expect(resolveInstallSource()).resolves.toBe("app-store");
  });
});

describe("getStoreLinks", () => {
  beforeEach(() => {
    // Fresh module per test: the in-memory link cache is session-long.
    vi.resetModules();
  });

  it("merges valid remote stores over the bundled defaults", async () => {
    mocks.fetch.mockResolvedValue(RESPONSE(REMOTE_STORES));
    const links = await (await storeReview()).getStoreLinks();
    expect(links.play.name).toBe("Play Store");
    expect(links["app-store"].url).toBe("https://apps.test/animu");
    expect(links.altstore).toEqual(DEFAULT_STORE_LINKS.altstore);
  });

  it("falls back to the defaults when the endpoint is unreachable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.fetch.mockRejectedValue(new Error("offline"));
    await expect((await storeReview()).getStoreLinks()).resolves.toEqual(
      DEFAULT_STORE_LINKS,
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to the defaults on an invalid payload shape", async () => {
    mocks.fetch.mockResolvedValue(RESPONSE({ version: 2 }));
    await expect((await storeReview()).getStoreLinks()).resolves.toEqual(
      DEFAULT_STORE_LINKS,
    );
  });

  it("keeps a store's default when its remote entry is broken", async () => {
    mocks.fetch.mockResolvedValue(
      RESPONSE({
        version: 1,
        stores: {
          play: { name: 42, url: "https://play.test" },
          altstore: { ...DEFAULT_STORE_LINKS.altstore },
        },
      }),
    );
    const links = await (await storeReview()).getStoreLinks();
    expect(links.play).toEqual(DEFAULT_STORE_LINKS.play);
    expect(links.altstore).toEqual(DEFAULT_STORE_LINKS.altstore);
  });

  it("treats an unsanctioned URL scheme as no link", async () => {
    mocks.fetch.mockResolvedValue(
      RESPONSE({
        version: 1,
        stores: {
          play: { ...DEFAULT_STORE_LINKS.play, url: "ftp://play.test" },
          "app-store": { name: "App Store", url: "market://apps.test" },
        },
      }),
    );
    const links = await (await storeReview()).getStoreLinks();
    expect(links.play.name).toBe("Google Play");
    expect(links.play.url).toBeNull();
    expect(links["app-store"].url).toBe("market://apps.test");
  });

  it("shares one fetch between concurrent callers", async () => {
    mocks.fetch.mockResolvedValue(RESPONSE(REMOTE_STORES));
    const { getStoreLinks } = await storeReview();
    const [a, b] = await Promise.all([getStoreLinks(), getStoreLinks()]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("aborts a slow endpoint after five seconds", async () => {
    vi.useFakeTimers();
    // A fetch that honours the signal and never resolves on its own.
    mocks.fetch.mockImplementationOnce(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted")),
          );
        }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pending = (await storeReview()).getStoreLinks();
    await vi.advanceTimersByTimeAsync(4999);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual(DEFAULT_STORE_LINKS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("useStoreReview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("resolves the store, name and url once on mount", async () => {
    mocks.platformOS = "android";
    mocks.getInstallReferrerAsync.mockResolvedValueOnce("utm_source=google-play");
    mocks.fetch.mockResolvedValue(RESPONSE(REMOTE_STORES));
    const { useStoreReview } = await storeReview();
    const { result } = renderHook(() => useStoreReview());
    expect(result.current).toEqual({ store: null, name: null, url: null });
    await vi.waitFor(() =>
      expect(result.current).toEqual({
        store: "play",
        name: "Play Store",
        url: DEFAULT_STORE_LINKS.play.url,
      }),
    );
  });

  it("keeps the row dark when the resolved store isn't listed", async () => {
    mocks.platformOS = "ios";
    // The site's snapshot today: the App Store isn't listed yet.
    mocks.fetch.mockResolvedValue(
      RESPONSE({ version: 1, stores: { ...DEFAULT_STORE_LINKS } }),
    );
    const { useStoreReview } = await storeReview();
    const { result } = renderHook(() => useStoreReview());
    await vi.waitFor(() =>
      expect(result.current).toEqual({
        store: "app-store",
        name: "App Store",
        url: null,
      }),
    );
  });
});
