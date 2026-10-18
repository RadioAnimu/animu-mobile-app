// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoverDataSection } from "@/screens/Settings/sections/CoverDataSection";

const mocks = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  save: vi.fn(async () => true),
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
vi.mock("@/constants/artwork-quality", () => ({
  COVER_QUALITY_SAMPLES: [],
  DEFAULT_COVER_SOURCE: 0,
}));
vi.mock("@/components/Select", () => ({
  Select: ({ description }: { description?: string }) => <p>{description}</p>,
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: mocks.settings }),
}));
vi.mock("@/hooks/useSaveSettings", () => ({ useSaveSettings: () => mocks.save }));

const toggles = () => screen.getAllByRole("switch");

describe("CoverDataSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings = {
      liveQualityCover: "medium",
      lastRequestedCovers: true,
      lastPlayedCovers: false,
      coversInRequestSearch: true,
    };
  });
  afterEach(cleanup);

  it("lets the per-surface toggles save while covers are on", () => {
    render(<CoverDataSection />);
    expect(screen.getByText("SETTINGS_QUALITY_ROW_DESC")).toBeTruthy();
    expect(toggles().map((toggle) => toggle.getAttribute("aria-disabled"))).toEqual([null, null, null]);
    fireEvent.click(toggles()[1]);
    expect(mocks.save).toHaveBeenCalledWith({ lastPlayedCovers: true });
  });

  it("dims the toggles, keeping their values, and explains why while covers are off", () => {
    mocks.settings = { ...mocks.settings, liveQualityCover: "off" };
    render(<CoverDataSection />);
    expect(screen.getByText("SETTINGS_COVERS_OFF_HINT")).toBeTruthy();
    expect(toggles().map((toggle) => toggle.getAttribute("aria-disabled"))).toEqual(["true", "true", "true"]);
    expect(toggles().map((toggle) => toggle.getAttribute("aria-checked"))).toEqual(["true", "false", "true"]);
  });
});
