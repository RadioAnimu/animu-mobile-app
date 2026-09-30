import { afterEach, describe, expect, it, vi } from "vitest";

// client-context collects native info at import time, so each case mocks the
// native modules and re-imports a fresh copy.
async function loadClientInfo(opts: {
  os: string;
  deviceType?: number;
  expoConfig?: Record<string, unknown> | null;
  nativeBuildVersion?: string | null;
}) {
  vi.resetModules();
  vi.doMock("react-native", () => ({
    Platform: { OS: opts.os, Version: "9" },
  }));
  vi.doMock("expo-application", () => ({
    nativeApplicationVersion: "2.2.0",
    nativeBuildVersion: opts.nativeBuildVersion ?? null,
  }));
  vi.doMock("expo-device", () => ({
    osVersion: "18",
    modelName: "Test",
    deviceType: opts.deviceType,
    DeviceType: { TABLET: 2, PHONE: 1 },
    manufacturer: "Test",
    isDevice: true,
  }));
  vi.doMock("expo-localization", () => ({
    getLocales: () => [{ languageTag: "en-US", regionCode: "US" }],
  }));
  vi.doMock("expo-constants", () => ({
    default: { expoConfig: opts.expoConfig ?? null },
  }));
  return (await import("@/utils/client-context")).CLIENT_INFO;
}

describe("CLIENT_INFO", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it.each([
    ["ios", "ios", "iOS"],
    ["android", "android", "Android"],
    ["web", "web", "Web"],
    ["windows", "other", "Web"],
  ])("maps Platform.OS %s to platform %s / os %s", async (rnOs, platform, os) => {
    const info = await loadClientInfo({ os: rnOs });
    expect(info.platform).toBe(platform);
    expect(info.os).toBe(os);
  });

  it.each([
    ["ios", 2, "tablet"],
    ["ios", 1, "phone"],
    ["android", 3, "unknown"],
    ["web", 3, "web"],
  ])("maps %s device type %s to %s", async (rnOs, deviceType, expected) => {
    const info = await loadClientInfo({ os: rnOs, deviceType });
    expect(info.deviceType).toBe(expected);
  });

  it("falls back to the per-platform build number from the expo config", async () => {
    const config = {
      ios: { buildNumber: "7" },
      android: { versionCode: 42 },
    };
    expect(
      (await loadClientInfo({ os: "ios", expoConfig: config })).build,
    ).toBe("7");
    expect(
      (await loadClientInfo({ os: "android", expoConfig: config })).build,
    ).toBe("42");
  });
});
