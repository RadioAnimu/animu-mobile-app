// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListenStatsSection } from "@/screens/Settings/sections/ListenStatsSection";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  totalMs: 0,
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
vi.mock("@react-navigation/native", async () => {
  const React = await import("react");
  return { useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
vi.mock("@/core/services/listen-stats.service", () => ({
  listenStatsService: {
    initialize: mocks.initialize,
    getSnapshot: () => ({ totalMs: mocks.totalMs }),
  },
}));

const statsRow = () => screen.getByRole("button", { name: /STATS_SETTINGS_ROW/ });

describe("ListenStatsSection", () => {
  beforeEach(() => {
    mocks.totalMs = 0;
    mocks.initialize.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("describes where the stats live and shows the loading placeholder first", () => {
    render(<ListenStatsSection onPress={vi.fn()} />);
    expect(screen.getByText("SETTINGS_STATS_DESC")).toBeTruthy();
    expect(statsRow().getAttribute("aria-label")).toContain("SETTINGS_VALUE_LOADING");
  });

  it("shows the total once read", async () => {
    mocks.totalMs = 90 * 60_000;
    render(<ListenStatsSection onPress={vi.fn()} />);
    await vi.waitFor(() => expect(statsRow().getAttribute("aria-label")).toContain("1STATS_UNIT_HOURS 30STATS_UNIT_MINUTES"));
  });

  it("shows a dash that is spoken as 'nothing recorded' when empty", async () => {
    render(<ListenStatsSection onPress={vi.fn()} />);
    await vi.waitFor(() => expect(screen.getByText("—")).toBeTruthy());
    expect(statsRow().getAttribute("aria-label")).toContain("SETTINGS_STATS_EMPTY");
  });

  it("says so when the read failed instead of passing for empty", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.initialize.mockRejectedValue(new Error("storage"));
    render(<ListenStatsSection onPress={vi.fn()} />);
    await vi.waitFor(() => expect(statsRow().getAttribute("aria-label")).toContain("SETTINGS_VALUE_FAILED"));
    expect(screen.queryByText("—")).toBeNull();
    warn.mockRestore();
  });
});
