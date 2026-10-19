// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_STORE_LINKS } from "@/api/store-links";
import { resolveInstallSource } from "@/hooks/useStoreReview";

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
  (await import("@/hooks/useStoreReview")) as typeof import("@/hooks/useStoreReview");

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
