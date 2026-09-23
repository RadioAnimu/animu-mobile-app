import { describe, expect, it, vi } from "vitest";

import { isTrustedDownloadUrl } from "@/core/ota/ota.service";

// ota.service pulls react-native + expo modules at import time; the URL
// validator is the only exported pure surface worth unit-testing here.
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-application", () => ({
  nativeApplicationVersion: "2.2.0",
  nativeBuildVersion: "4",
}));
vi.mock("expo/fetch", () => ({ fetch: vi.fn() }));
vi.mock("react-native-ota-hot-update", () => ({ default: {} }));
vi.mock("react-native-blob-util", () => ({ default: {} }));

const releaseUrl = (file: string) =>
  `https://github.com/RadioAnimu/animu-mobile-app/releases/download/ota/${file}`;

describe("isTrustedDownloadUrl", () => {
  it("accepts this repository's release assets over HTTPS", () => {
    expect(isTrustedDownloadUrl(releaseUrl("index.android.bundle.zip"))).toBe(
      true,
    );
  });

  it("rejects HTTP and other origins", () => {
    expect(
      isTrustedDownloadUrl(
        "http://github.com/RadioAnimu/animu-mobile-app/releases/download/ota/index.android.bundle",
      ),
    ).toBe(false);
    expect(
      isTrustedDownloadUrl(
        "https://evil.example/RadioAnimu/animu-mobile-app/releases/download/ota/index.android.bundle",
      ),
    ).toBe(false);
  });

  it("rejects other repos and paths on github.com", () => {
    expect(
      isTrustedDownloadUrl(
        "https://github.com/RadioAnimu/some-other-app/releases/download/ota/bundle",
      ),
    ).toBe(false);
    expect(
      isTrustedDownloadUrl(
        "https://github.com/RadioAnimu/animu-mobile-app/blob/main/package.json",
      ),
    ).toBe(false);
  });

  it("rejects garbage and absent URLs", () => {
    expect(isTrustedDownloadUrl(undefined)).toBe(false);
    expect(isTrustedDownloadUrl("")).toBe(false);
    expect(isTrustedDownloadUrl("not a url")).toBe(false);
    expect(isTrustedDownloadUrl("//cdn.example/bundle")).toBe(false);
  });
});
