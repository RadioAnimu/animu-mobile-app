import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrientationLock } from "expo-screen-orientation/build/ScreenOrientation.types";

const mocks = vi.hoisted(() => ({
  screen: { width: 393, height: 852 },
  platform: { OS: "ios", isPad: false } as Record<string, unknown>,
  lockAsync: vi.fn(async (_lock: number) => {}),
  unlockAsync: vi.fn(async () => {}),
}));

vi.mock("react-native", () => ({
  Dimensions: { get: () => mocks.screen },
  Platform: mocks.platform,
}));
vi.mock("expo-screen-orientation", async () => ({
  // The real enum: a test must fail if the lock is the wrong one.
  OrientationLock: (await import("expo-screen-orientation/build/ScreenOrientation.types")).OrientationLock,
  lockAsync: mocks.lockAsync,
  unlockAsync: mocks.unlockAsync,
}));

const load = async () => {
  vi.resetModules();
  return import("@/routes/orientation");
};
/** Lets the queued orientation calls run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("phone orientation policy", () => {
  beforeEach(() => {
    mocks.screen = { width: 393, height: 852 };
    mocks.platform.OS = "ios";
    mocks.platform.isPad = false;
    mocks.lockAsync.mockReset();
    mocks.lockAsync.mockImplementation(async () => {});
    mocks.unlockAsync.mockClear();
  });

  it("lets a phone turn on the player only", async () => {
    const { locksPortrait } = await load();
    expect(locksPortrait("Home", true)).toBe(false);
    expect(locksPortrait("Lyrics", true)).toBe(false);
    for (const route of ["LastPlayed", "LastRequested", "MakeRequest", "Settings", "About", "Login"]) {
      expect(locksPortrait(route, true)).toBe(true);
    }
    // Tablets turn freely everywhere.
    expect(locksPortrait("Settings", false)).toBe(false);
  });

  it("tells phones from tablets by the screen, not the window", async () => {
    const { isPhone } = await load();
    expect(isPhone()).toBe(true);
    // Landscape phone: the short side is still a phone's.
    mocks.screen = { width: 852, height: 393 };
    expect(isPhone()).toBe(true);
    mocks.screen = { width: 1180, height: 820 };
    expect(isPhone()).toBe(false);
    // Any iPad by its idiom.
    mocks.screen = { width: 393, height: 852 };
    mocks.platform.isPad = true;
    expect(isPhone()).toBe(false);
  });

  it("locks upright once per change, and frees the player again", async () => {
    const { applyOrientationPolicy } = await load();
    applyOrientationPolicy("Home");
    await flush();
    expect(mocks.unlockAsync).toHaveBeenCalledTimes(1);
    applyOrientationPolicy("Settings");
    applyOrientationPolicy("About");
    await flush();
    expect(mocks.lockAsync).toHaveBeenCalledTimes(1);
    expect(mocks.lockAsync).toHaveBeenCalledWith(OrientationLock.PORTRAIT_UP);
    applyOrientationPolicy("Lyrics");
    await flush();
    expect(mocks.unlockAsync).toHaveBeenCalledTimes(2);
  });

  it("ends a burst of navigation on the latest route's lock", async () => {
    const { applyOrientationPolicy } = await load();
    applyOrientationPolicy("Settings");
    applyOrientationPolicy("Home");
    await flush();
    // Each queued call reads the latest route: the player, never locked.
    expect(mocks.lockAsync).not.toHaveBeenCalled();
    expect(mocks.unlockAsync).toHaveBeenCalledTimes(1);
  });

  it("tries again after a call fails mid-transition", async () => {
    vi.useFakeTimers();
    const { applyOrientationPolicy } = await load();
    mocks.lockAsync.mockRejectedValueOnce(new Error("transition in progress"));
    applyOrientationPolicy("Settings");
    await vi.runAllTimersAsync();
    expect(mocks.lockAsync).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("re-checks the lock when the screen crosses the phone / tablet line", async () => {
    const { applyOrientationPolicy, refreshOrientationPolicy } = await load();
    applyOrientationPolicy("Settings");
    await flush();
    expect(mocks.lockAsync).toHaveBeenCalledTimes(1);
    // A foldable opens: the same screen is now a tablet's.
    mocks.screen = { width: 1812, height: 2176 };
    refreshOrientationPolicy();
    await flush();
    expect(mocks.unlockAsync).toHaveBeenCalledTimes(1);
  });
});
