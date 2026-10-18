import { beforeEach, expect, it, vi } from "vitest";

import { THEME } from "@/theme";
import { openExternal, openInAppBrowser } from "@/utils/browser";

const { openBrowserAsync, openURL } = vi.hoisted(() => ({
  openBrowserAsync: vi.fn(),
  openURL: vi.fn(),
}));
// The theme measures Dimensions at module load; a plain stub keeps this node-run.
vi.mock("react-native", () => ({
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
}));
vi.mock("expo-web-browser", () => ({ openBrowserAsync }));
vi.mock("expo-linking", () => ({ openURL }));

beforeEach(() => {
  openBrowserAsync.mockReset();
  openURL.mockReset();
});

it("passes the app's themed chrome to the in-app browser", async () => {
  openBrowserAsync.mockResolvedValue({ type: "browser" });
  await openInAppBrowser("https://purple.test");
  expect(openBrowserAsync).toHaveBeenCalledExactlyOnceWith("https://purple.test", {
    toolbarColor: THEME.COLORS.BG_DEEP,
    controlsColor: THEME.COLORS.BRAND,
    secondaryToolbarColor: THEME.COLORS.SURFACE,
    showTitle: true,
    enableBarCollapsing: true,
  });
  expect(openURL).not.toHaveBeenCalled();
});

it("falls back to the system browser when the in-app one fails", async () => {
  openBrowserAsync.mockRejectedValue(
    new Error("No Custom Tabs-capable browser"),
  );
  openURL.mockResolvedValue(true);
  await openInAppBrowser("https://purple.test");
  expect(openURL).toHaveBeenCalledExactlyOnceWith("https://purple.test");
});

it("rejects when both the in-app browser and the fallback fail", async () => {
  openBrowserAsync.mockRejectedValue(new Error("no Custom Tabs browser"));
  openURL.mockRejectedValue(new Error("no browser at all"));
  await expect(openInAppBrowser("https://purple.test")).rejects.toThrow(
    "no browser at all",
  );
});

it("never stacks Safari when iOS reports a session already open", async () => {
  // Shape of expo-web-browser's native WebBrowserAlreadyOpenException.
  openBrowserAsync.mockRejectedValue(
    Object.assign(new Error("Another web browser is already open"), {
      code: "ERR_WEB_BROWSER_ALREADY_OPEN",
    }),
  );
  await openInAppBrowser("https://purple.test");
  expect(openURL).not.toHaveBeenCalled();
});

it("lets a second tap while a session is up fall through, without a fallback", async () => {
  let release: () => void = () => {};
  openBrowserAsync.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = () => resolve({ type: "browser" });
      }),
  );

  const first = openInAppBrowser("https://purple.test");
  await expect(openInAppBrowser("https://other.test")).resolves.toBeUndefined();
  expect(openBrowserAsync).toHaveBeenCalledTimes(1);
  expect(openURL).not.toHaveBeenCalled();

  release();
  await first;
});

it("reopens for the next link once the session has closed", async () => {
  openBrowserAsync.mockResolvedValue({ type: "browser" });
  await openInAppBrowser("https://purple.test");
  await openInAppBrowser("https://other.test");
  expect(openBrowserAsync).toHaveBeenCalledTimes(2);
});

it("hands links that leave the app straight to the system", async () => {
  openURL.mockResolvedValue(true);
  await openExternal("https://discord.gg/test");
  expect(openURL).toHaveBeenCalledExactlyOnceWith("https://discord.gg/test");
  expect(openBrowserAsync).not.toHaveBeenCalled();
});
