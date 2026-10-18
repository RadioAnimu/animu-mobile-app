// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpSection } from "@/screens/Settings/sections/HelpSection";

const mocks = vi.hoisted(() => ({
  openInAppBrowser: vi.fn(async () => undefined),
  onOpenAbout: vi.fn(),
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@/components/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
vi.mock("@/components/SectionTitle", () => ({ SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2> }));
vi.mock("@/hooks/useStackedRows", () => ({ useStackedRows: () => false }));
vi.mock("@/components/Avatar", () => ({ Avatar: () => null }));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn(), warning: vi.fn(), select: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () =>
    new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "9.8.7" }));
vi.mock("@/utils/browser", () => ({
  openInAppBrowser: mocks.openInAppBrowser,
}));
vi.mock("@/api", () => ({ API: { PRIVACY_URL: "https://privacy.test" } }));

describe("HelpSection", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows the voice hint, the About row with the native version and the privacy link", () => {
    render(<HelpSection onOpenAbout={mocks.onOpenAbout} />);
    expect(screen.getByText("SETTINGS_HELP_TITLE")).toBeTruthy();
    expect(screen.getByText("SETTINGS_ASSISTANT_TITLE")).toBeTruthy();
    expect(screen.getByText("SETTINGS_ASSISTANT_HINT_ANDROID")).toBeTruthy();

    const about = screen.getByRole("button", { name: /SETTINGS_ABOUT_ROW/ });
    expect(about.getAttribute("aria-label")).toContain("v9.8.7");
    fireEvent.click(about);
    expect(mocks.onOpenAbout).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: /SETTINGS_PRIVACY_POLICY/ }));
    expect(mocks.openInAppBrowser).toHaveBeenCalledWith("https://privacy.test");
  });
});
