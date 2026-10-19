// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpSection } from "@/screens/Settings/sections/HelpSection";

const mocks = vi.hoisted(() => ({
  openInAppBrowser: vi.fn(async () => undefined),
  openExternal: vi.fn(async () => undefined),
  onOpenAbout: vi.fn(),
  useStoreReview: vi.fn(),
  toast: vi.fn(),
  dict: {} as Record<string, string | undefined>,
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@/components/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
vi.mock("@/components/SectionTitle", () => ({ SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2> }));
vi.mock("@/hooks/useStackedRows", () => ({ useStackedRows: () => false }));
vi.mock("@/components/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), warning: vi.fn(), select: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () =>
    new Proxy(mocks.dict, {
      get: (target, key) => target[String(key as string)] ?? String(key),
    }),
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "9.8.7" }));
vi.mock("@/hooks/useStoreReview", () => ({ useStoreReview: mocks.useStoreReview }));
vi.mock("@/utils/browser", () => ({
  openInAppBrowser: mocks.openInAppBrowser,
  openExternal: mocks.openExternal,
}));
vi.mock("@/api", () => ({ API: { PRIVACY_URL: "https://privacy.test" } }));

/** Interpolation is only visible with real templates behind the dict proxy. */
const withRealRatePhrases = () => {
  mocks.dict = {
    SETTINGS_RATE_APP_DESC: "Leave a 5-star review on {store}",
    SETTINGS_RATE_SOON: "Coming soon to {store}",
  };
};

const PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.nessjs.animu";

const storeReview = (review: unknown) =>
  mocks.useStoreReview.mockReturnValue(review);

describe("HelpSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRealRatePhrases();
    storeReview({ store: "play", name: "Google Play", url: PLAY_URL });
  });
  afterEach(cleanup);

  it("shows the rate row, the voice hint, the About row with the native version and the privacy link", () => {
    render(<HelpSection onOpenAbout={mocks.onOpenAbout} />);
    expect(screen.getByText("SETTINGS_HELP_TITLE")).toBeTruthy();
    const rate = screen.getByRole("link", { name: /SETTINGS_RATE_APP/ });
    expect(rate.getAttribute("aria-label")).toContain(
      "Leave a 5-star review on Google Play",
    );
    expect(screen.getByText("SETTINGS_ASSISTANT_TITLE")).toBeTruthy();
    expect(screen.getByText("SETTINGS_ASSISTANT_HINT_ANDROID")).toBeTruthy();

    const about = screen.getByRole("button", { name: /SETTINGS_ABOUT_ROW/ });
    expect(about.getAttribute("aria-label")).toContain("v9.8.7");
    fireEvent.click(about);
    expect(mocks.onOpenAbout).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: /SETTINGS_PRIVACY_POLICY/ }));
    expect(mocks.openInAppBrowser).toHaveBeenCalledWith("https://privacy.test");
  });

  it("opens the resolved store's page outside the app", () => {
    render(<HelpSection onOpenAbout={mocks.onOpenAbout} />);
    fireEvent.click(screen.getByRole("link", { name: /SETTINGS_RATE_APP/ }));
    expect(mocks.openExternal).toHaveBeenCalledWith(PLAY_URL);
    expect(mocks.openInAppBrowser).not.toHaveBeenCalled();
  });

  it("dims the row but keeps it tappable when the store isn't listed yet", async () => {
    storeReview({ store: "app-store", name: "App Store", url: null });
    render(<HelpSection onOpenAbout={mocks.onOpenAbout} />);
    const rate = screen.getByRole("link", { name: /SETTINGS_RATE_APP/ });
    expect(JSON.parse((rate as HTMLElement).dataset.style!)).toMatchObject({
      opacity: 0.5,
    });

    fireEvent.click(rate);
    await vi.waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        "Coming soon to App Store",
        "info",
      ),
    );
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });

  it("says where the review lands while the store is still resolving", () => {
    storeReview({ store: null, name: null, url: null });
    render(<HelpSection onOpenAbout={mocks.onOpenAbout} />);
    // No store name yet: no description that could flash a placeholder.
    expect(screen.getByRole("link", { name: "SETTINGS_RATE_APP" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: /SETTINGS_RATE_APP/ }));
    expect(mocks.openExternal).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("toast-errors instead of crashing when the store page refuses to open", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.openExternal.mockRejectedValueOnce(new Error("no store app"));
    render(<HelpSection onOpenAbout={mocks.onOpenAbout} />);
    fireEvent.click(screen.getByRole("link", { name: /SETTINGS_RATE_APP/ }));
    await vi.waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("SETTINGS_RATE_OPEN_ERROR", "error"),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
