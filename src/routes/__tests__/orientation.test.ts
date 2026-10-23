import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  screen: { width: 393, height: 852 },
  platform: { OS: "ios", isPad: false, isTV: false } as Record<string, unknown>,
  lockAsync: vi.fn(async () => {}),
  unlockAsync: vi.fn(async () => {}),
}));

vi.mock("react-native", () => ({
  Dimensions: { get: () => mocks.screen },
  Platform: mocks.platform,
}));
vi.mock("expo-screen-orientation", () => ({
  OrientationLock: { PORTRAIT_UP: 2 },
  lockAsync: mocks.lockAsync,
  unlockAsync: mocks.unlockAsync,
}));

const load = async () => {
  vi.resetModules();
  return import("@/routes/orientation");
};

describe("phone orientation policy", () => {
  beforeEach(() => {
    mocks.screen = { width: 393, height: 852 };
    mocks.platform.OS = "ios";
    mocks.platform.isPad = false;
    mocks.platform.isTV = false;
    mocks.lockAsync.mockClear();
    mocks.unlockAsync.mockClear();
  });

  it("lets a phone turn on the player only", async () => {
    const { locksPortrait } = await load();
    expect(locksPortrait("Home", true)).toBe(false);
    expect(locksPortrait("Lyrics", true)).toBe(false);
    for (const route of ["LastPlayed", "LastRequested", "MakeRequest", "Settings", "About", "Login"]) {
      expect(locksPortrait(route, true)).toBe(true);
    }
    // Tablets and TVs turn freely everywhere.
    expect(locksPortrait("Settings", false)).toBe(false);
  });

  it("tells phones from tablets and TVs by the screen, not the window", async () => {
    const { isPhone } = await load();
    expect(isPhone()).toBe(true);
    // Landscape phone: the short side is still a phone's.
    mocks.screen = { width: 852, height: 393 };
    expect(isPhone()).toBe(true);
    mocks.screen = { width: 1180, height: 820 };
    expect(isPhone()).toBe(false);
    // An iPad mini (744 short side) and any iPad by its idiom.
    mocks.screen = { width: 393, height: 852 };
    mocks.platform.isPad = true;
    expect(isPhone()).toBe(false);
    mocks.platform.isPad = false;
    mocks.platform.isTV = true;
    expect(isPhone()).toBe(false);
  });

  it("locks once per change, and frees the player again", async () => {
    const { applyOrientationPolicy } = await load();
    applyOrientationPolicy("Home");
    expect(mocks.unlockAsync).toHaveBeenCalledTimes(1);
    applyOrientationPolicy("Settings");
    applyOrientationPolicy("About");
    expect(mocks.lockAsync).toHaveBeenCalledTimes(1);
    expect(mocks.lockAsync).toHaveBeenCalledWith(2);
    applyOrientationPolicy("Lyrics");
    expect(mocks.unlockAsync).toHaveBeenCalledTimes(2);
  });
});
