// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { History } from "@/screens/History";

interface ListProps {
  data: { raw: string; startTime: string; artwork?: string }[];
  renderItem: (args: { item: ListProps["data"][number] }) => ReactNode;
  ListEmptyComponent: ReactElement;
  refreshControl: ReactElement<{ onRefresh: () => Promise<void>; refreshing: boolean }>;
}

vi.mock("react-native", async () => {
  const base = (await import("@/__tests__/react-native-mock")).createReactNativeMock();
  return {
    ...base,
    FlatList: ({ data, renderItem, ListEmptyComponent, refreshControl }: ListProps) => (
      <div data-testid="list" data-refreshing={String(refreshControl.props.refreshing)}>
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item) => <div key={item.raw}>{renderItem({ item })}</div>)}
        <button onClick={() => void refreshControl.props.onRefresh()}>pull</button>
      </div>
    ),
    RefreshControl: () => null,
  };
});
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock("expo-image", () => ({ Image: () => <span /> }));
vi.mock("@/components/HeaderBar", () => ({ HeaderBar: () => <header /> }));
vi.mock("@/components/Cover", () => ({
  Cover: ({ cover, category }: { cover?: string; category: string }) => (
    <i data-testid="cover" data-cover={cover} data-category={category} />
  ),
}));
vi.mock("@/i18n", () => ({
  IMGS: { PT: { LAST_REQUEST: "req.png", LAST_PLAYED: "played.png" } },
}));

const mocks = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  station: {} as Record<string, unknown>,
  player: {} as Record<string, unknown>,
  copy: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: mocks.settings }),
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => mocks.player,
  useStation: () => mocks.station,
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));
vi.mock("@/hooks/useCopyToClipboard", () => ({ useCopyToClipboard: () => mocks.copy }));
vi.mock("@/hooks/useRouteReselect", () => ({ useRouteReselect: () => undefined }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ HISTORY_EMPTY: "Nothing yet", REQUEST_ERROR: "Request failed" }),
}));

const track = (raw: string, artwork = `https://cdn/${raw}.jpg`) => ({
  raw,
  artwork,
  startTime: "2026-01-01T10:30:00Z",
});

function renderHistory(historyType: "requests" | "played") {
  const route = {
    key: "k",
    name: historyType === "requests" ? "LastRequested" : "LastPlayed",
    params: { historyType },
  };
  return render(<History {...({ route } as unknown as React.ComponentProps<typeof History>)} />);
}

describe("History", () => {
  beforeEach(() => {
    mocks.settings = {
      selectedLanguage: "PT",
      lastRequestedCovers: true,
      lastPlayedCovers: false,
    };
    mocks.station = {
      lastRequestedTracks: [track("Requested A"), track("Requested B")],
      lastPlayedTracks: [track("Played A")],
    };
    mocks.player = {
      refreshData: vi.fn().mockResolvedValue(undefined),
      refreshHistory: vi.fn().mockResolvedValue(undefined),
    };
  });
  afterEach(cleanup);

  it("lists the requested tracks with covers, honouring lastRequestedCovers", () => {
    renderHistory("requests");
    expect(screen.getByText("Requested A")).toBeTruthy();
    expect(screen.getByText("Requested B")).toBeTruthy();
    expect(screen.queryByText("Played A")).toBeNull();
    const covers = screen.getAllByTestId("cover");
    expect(covers).toHaveLength(2);
    expect(covers[0].getAttribute("data-category")).toBe("requested");
  });

  it("hides requested covers when that setting is off (played setting is independent)", () => {
    mocks.settings = { ...mocks.settings, lastRequestedCovers: false, lastPlayedCovers: true };
    renderHistory("requests");
    expect(screen.queryAllByTestId("cover")).toHaveLength(0);
  });

  it("played history follows lastPlayedCovers, not the requested setting", () => {
    renderHistory("played");
    expect(screen.getByText("Played A")).toBeTruthy();
    expect(screen.queryAllByTestId("cover")).toHaveLength(0);

    cleanup();
    mocks.settings = { ...mocks.settings, lastPlayedCovers: true, lastRequestedCovers: false };
    renderHistory("played");
    const cover = screen.getByTestId("cover");
    expect(cover.getAttribute("data-category")).toBe("played");
    expect(cover.getAttribute("data-cover")).toBe("https://cdn/Played A.jpg");
  });

  it("shows airtime only in the requests list", () => {
    renderHistory("requests");
    expect(screen.getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(2);
    cleanup();
    renderHistory("played");
    expect(screen.queryByText(/^\d{2}:\d{2}$/)).toBeNull();
  });

  it("shows the empty notice when there is no history", () => {
    mocks.station = { lastRequestedTracks: [], lastPlayedTracks: [] };
    renderHistory("played");
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });

  it("copies a track's name when tapped", () => {
    renderHistory("requests");
    fireEvent.click(screen.getByText("Requested B"));
    expect(mocks.copy).toHaveBeenCalledExactlyOnceWith("Requested B");
  });

  it("pull-to-refresh reloads the feed on screen", async () => {
    renderHistory("requests");
    await act(async () => void fireEvent.click(screen.getByText("pull")));
    expect(mocks.player.refreshHistory).toHaveBeenCalledExactlyOnceWith("requests");
    expect(mocks.player.refreshData).not.toHaveBeenCalled();

    cleanup();
    renderHistory("played");
    await act(async () => void fireEvent.click(screen.getByText("pull")));
    expect(mocks.player.refreshHistory).toHaveBeenLastCalledWith("played");
  });

  it("tells the user when a refresh fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.player = { ...mocks.player, refreshHistory: vi.fn().mockRejectedValue(new Error("x")) };
    renderHistory("requests");
    await act(async () => void fireEvent.click(screen.getByText("pull")));
    expect(mocks.toast).toHaveBeenCalledWith("Request failed", "error");
    expect(screen.getByTestId("list").getAttribute("data-refreshing")).toBe("false");
    warn.mockRestore();
  });
});
