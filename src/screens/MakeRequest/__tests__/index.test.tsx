// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { KeyboardController } from "react-native-keyboard-controller";
import { useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrackRequestContext } from "@/components/RequestTrack/context";
import { MakeRequest } from "@/screens/MakeRequest";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("react-native-keyboard-controller", async () =>
  (
    await import("@/__tests__/keyboard-controller-mock")
  ).createKeyboardControllerMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

interface Track {
  id: string;
  title: string;
  artwork?: string;
  requestable: boolean;
}

vi.mock("@/components/HeaderBar", () => ({ HeaderBar: () => <header /> }));
vi.mock("@/components/Logo", () => ({ Logo: () => <i /> }));
vi.mock("@/components/RequestTrack", () => ({
  RequestTrack: ({ track }: { track: Track }) => {
    const onRequest = useContext(TrackRequestContext);
    return (
      <button onClick={() => onRequest(track as never)}>
        {track.title}
        {track.requestable ? "" : " (sent)"}
      </button>
    );
  },
}));
const sheet = vi.hoisted(() => ({
  props: null as null | {
    visible: boolean;
    track?: Track;
    onClose: () => void;
    onSubmit: (
      message: string,
    ) => Promise<{ success: boolean; message: string }>;
    onRequestSuccess: (trackId: string) => void;
  },
}));
vi.mock("@/components/RequestBottomSheet", () => ({
  RequestBottomSheet: (props: NonNullable<typeof sheet.props>) => {
    sheet.props = props;
    return <div data-testid="sheet" data-visible={String(props.visible)} />;
  },
}));
vi.mock("@/screens/MakeRequest/ResultsList", () => ({
  ResultsList: ({
    data,
    renderItem,
    showEmpty,
    emptyLabel,
    countLabel,
    onRefresh,
    onEndReached,
    loadingMore,
  }: {
    data: Track[];
    renderItem: (args: { item: Track }) => ReactNode;
    showEmpty: boolean;
    emptyLabel: string;
    countLabel?: string;
    onRefresh: () => void;
    onEndReached: () => void;
    loadingMore: boolean;
  }) => (
    <div data-testid="results" data-loading-more={String(loadingMore)}>
      {countLabel && <h2>{countLabel}</h2>}
      {data.map((item) => (
        <div key={item.id}>{renderItem({ item })}</div>
      ))}
      {showEmpty && <p>{emptyLabel}</p>}
      <button onClick={onRefresh}>refresh</button>
      <button onClick={onEndReached}>more</button>
    </div>
  ),
}));

const mocks = vi.hoisted(() => ({
  user: null as null | { sessionToken: string },
  profile: null as null | { user: { verified: boolean } },
  settings: { selectedLanguage: "PT" },
  showError: vi.fn(),
  recent: {
    recent: [] as {
      query: string;
      total: number | null;
      searchedAt: number;
      uses: number;
    }[],
    addRecent: vi.fn(),
    removeRecent: vi.fn(),
    clearRecent: vi.fn(),
    restoreRecent: vi.fn(),
  },
  haptics: { select: vi.fn(), error: vi.fn() },
  service: {
    searchTracksByTitle: vi.fn(),
    searchTracksByQuery: vi.fn(),
    submitRequest: vi.fn(),
  },
  submissionError: vi.fn(() => "mapped error"),
  isLive: false,
  navigation: { isFocused: vi.fn(() => true), navigate: vi.fn() },
}));

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => mocks.navigation,
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => ({
    currentProgram: mocks.isLive ? { isLive: true } : undefined,
  }),
}));

vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.showError }),
}));
vi.mock("@/contexts/auth/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, profile: mocks.profile }),
}));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({
  useUserSettings: () => ({ settings: mocks.settings }),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    REQUEST_SEARCH_PLACEHOLDER: "Search a title",
    A11Y_CLEAR_SEARCH: "Clear search",
    REQUEST_SEARCH_MIN: "Type at least 3 letters",
    REQUEST_SEARCH_ERROR: "Search failed",
    REQUEST_SEARCH_EMPTY: "No results",
    REQUEST_SEARCH_RECENT: "Recent",
    REQUEST_SEARCH_RECENT_CLEAR: "Clear recent",
    REQUEST_SEARCH_RECENT_REMOVE: "Remove",
    REQUEST_SEARCH_RECENT_MATCHES: "Matching recent",
    REQUEST_SEARCH_RECENT_EDIT: "Edit",
    REQUEST_SEARCH_COUNT_ONE: "1 result",
    REQUEST_SEARCH_COUNT_N: "{n} results",
    REQUEST_SEARCH_COUNT_FOR: "{count} for {query}",
    NUMBER_DECIMAL_SEPARATOR: ".",
    REQUEST_SEARCH_RUN: "Search {query}",
    REQUEST_SEARCH_RECENT_SHOW_ALL: "Show all ({n})",
    REQUEST_SEARCH_RECENT_SHOW_LESS: "Show less",
    REQUEST_SEARCH_RECENT_REMOVED: "Removed",
    REQUEST_SEARCH_RECENT_CLEARED: "Cleared",
    UNDO: "Undo",
    ERROR_RETRY: "Retry",
    REQUEST_NEEDS_SIGN_IN: "Sign in to request songs.",
    REQUEST_SIGN_IN_ACTION: "Sign in",
    REQUEST_NEEDS_VERIFIED: "Needs Discord with 2FA.",
    REQUEST_VERIFY_ACTION: "Set up",
    SELECT_ERROR: "Pick a track",
    REQUEST_SUCCESS: "Requested!",
    REQUEST_ERROR_ONAIR: "Requests are disabled while a DJ is live.",
  }),
}));
vi.mock("@/hooks/useRecentSearches", () => ({
  useRecentSearches: () => mocks.recent,
}));
vi.mock("@/hooks/useRouteReselect", () => ({
  useRouteReselect: () => undefined,
}));
vi.mock("@/i18n", () => ({ IMGS: { PT: { MAKE_REQUEST: "make.png" } } }));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/core/services/music-request.service", () => ({
  musicRequestService: mocks.service,
  getSubmissionErrorMessage: mocks.submissionError,
}));

const page = (
  titles: string[],
  nextPageParams?: object,
  totalResults = titles.length,
) => ({
  results: titles.map((title) => ({ id: title, title, requestable: true })),
  nextPageParams,
  totalResults,
});

const entry = (
  query: string,
  total: number | null = 10,
  searchedAt = 0,
  uses = 1,
) => ({ query, total, searchedAt, uses });

const field = () => screen.getByRole("textbox", { name: "Search a title" });
const type = (value: string) =>
  fireEvent.change(field(), { target: { value } });
const submit = () => fireEvent.keyDown(field(), { key: "Enter" });

async function search(query: string) {
  type(query);
  await act(async () => void submit());
}

describe("MakeRequest screen", () => {
  beforeEach(() => {
    mocks.user = { sessionToken: "sess" };
    mocks.profile = null;
    mocks.isLive = false;
    mocks.navigation.isFocused.mockReturnValue(true);
    mocks.navigation.navigate.mockClear();
    mocks.showError.mockClear();
    mocks.recent.recent = [];
    mocks.service.searchTracksByTitle.mockResolvedValue(
      page(["Gurenge", "Gurenge 2"]),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sheet.props = null;
  });

  describe("live show lock", () => {
    it("stays put while the AutoDJ is on air", () => {
      render(<MakeRequest />);
      expect(mocks.navigation.navigate).not.toHaveBeenCalled();
    });

    it("sends a focused screen back Home when a live show starts", () => {
      mocks.isLive = true;
      render(<MakeRequest />);
      expect(mocks.navigation.navigate).toHaveBeenCalledExactlyOnceWith("Home");
      expect(mocks.showError).toHaveBeenCalledWith(
        "Requests are disabled while a DJ is live.",
        "error",
      );
    });

    it("does not yank the user off another screen", () => {
      mocks.isLive = true;
      mocks.navigation.isFocused.mockReturnValue(false);
      render(<MakeRequest />);
      expect(mocks.navigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe("request eligibility banner", () => {
    it("asks a signed-out user to sign in, and the chip opens Login", () => {
      mocks.user = null;
      render(<MakeRequest />);
      expect(screen.getByText("Sign in to request songs.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      expect(mocks.navigation.navigate).toHaveBeenCalledExactlyOnceWith(
        "Login",
      );
    });

    it("sends an unverified account to Account to set up Discord + 2FA", () => {
      mocks.profile = { user: { verified: false } };
      render(<MakeRequest />);
      expect(screen.getByText("Needs Discord with 2FA.")).toBeTruthy();
      expect(screen.queryByText("Sign in to request songs.")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Set up" }));
      expect(mocks.navigation.navigate).toHaveBeenCalledExactlyOnceWith(
        "Account",
      );
    });

    it("stays visible while the search field is focused", () => {
      mocks.user = null;
      render(<MakeRequest />);
      fireEvent.focus(field());
      expect(screen.getByText("Sign in to request songs.")).toBeTruthy();
    });

    it("is absent for a verified account", () => {
      mocks.profile = { user: { verified: true } };
      render(<MakeRequest />);
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
    });

    it("is absent while the profile is still loading (the server decides)", () => {
      mocks.profile = null;
      render(<MakeRequest />);
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
    });
  });

  describe("searching", () => {
    beforeEach(() => void render(<MakeRequest />));

    it("does not search, and hints, for queries under 3 characters", async () => {
      type("ab");
      expect(screen.getByText("Type at least 3 letters")).toBeTruthy();
      await act(async () => void submit());
      expect(mocks.service.searchTracksByTitle).not.toHaveBeenCalled();
      type("abc");
      expect(screen.queryByText("Type at least 3 letters")).toBeNull();
    });

    it("searches on submit, lists results and remembers the query", async () => {
      await search("  guren ");
      expect(mocks.service.searchTracksByTitle).toHaveBeenCalledExactlyOnceWith(
        "guren",
      );
      expect(screen.getByText("Gurenge")).toBeTruthy();
      expect(screen.getByText("Gurenge 2")).toBeTruthy();
      expect(mocks.recent.addRecent).toHaveBeenCalledWith("guren", 2);
    });

    it("heads the results with the exact total for the searched query", async () => {
      mocks.service.searchTracksByTitle.mockResolvedValue(
        page(["A"], { page: 2 }, 3177),
      );
      await search("guren");
      expect(screen.getByText("3,177 results for guren")).toBeTruthy();
    });

    it("keeps text typed while a search is in flight", async () => {
      let resolve: (value: unknown) => void = () => undefined;
      mocks.service.searchTracksByTitle.mockReturnValue(
        new Promise((res) => (resolve = res)),
      );
      type("guren");
      act(() => void submit());
      type("gurenge");
      await act(async () => resolve(page(["Gurenge"])));
      expect((field() as HTMLInputElement).value).toBe("gurenge");
    });

    it("drops a search that lands after the field was cleared", async () => {
      let resolve: (value: unknown) => void = () => undefined;
      mocks.service.searchTracksByTitle.mockReturnValue(
        new Promise((res) => (resolve = res)),
      );
      type("guren");
      act(() => void submit());
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      await act(async () => resolve(page(["Gurenge"])));
      expect(screen.queryByText("Gurenge")).toBeNull();
      expect(mocks.recent.addRecent).not.toHaveBeenCalled();
    });

    it("shows a spinner instead of the list while the search is in flight", async () => {
      let resolve: (value: unknown) => void = () => undefined;
      mocks.service.searchTracksByTitle.mockReturnValue(
        new Promise((res) => (resolve = res)),
      );
      type("guren");
      act(() => void submit());
      expect(screen.getByRole("progressbar")).toBeTruthy();
      expect(screen.queryByTestId("results")).toBeNull();
      await act(async () => resolve(page(["Gurenge"])));
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByText("Gurenge")).toBeTruthy();
    });

    it("shows the empty label only after a search found nothing", async () => {
      mocks.service.searchTracksByTitle.mockResolvedValue(page([]));
      expect(screen.queryByText("No results")).toBeNull();
      await search("zzzz");
      expect(screen.getByText("No results")).toBeTruthy();
      // A different, not yet searched query doesn't inherit the verdict.
      type("yyyy");
      expect(screen.queryByText("No results")).toBeNull();
    });

    it("reports a failed search, shows the retry banner, and retry recovers", async () => {
      mocks.service.searchTracksByTitle.mockRejectedValueOnce(
        new Error("offline"),
      );
      await search("guren");
      expect(mocks.showError).toHaveBeenCalledWith("Search failed", "error");
      expect(mocks.haptics.error).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Retry")).toBeTruthy();
      // No contradictory "no results" next to the error.
      expect(screen.queryByText("No results")).toBeNull();

      await act(
        async () =>
          void fireEvent.click(screen.getByRole("button", { name: "Retry" })),
      );
      expect(screen.queryByText("Retry")).toBeNull();
      expect(screen.getByText("Gurenge")).toBeTruthy();
    });

    it("clearing empties the field, results and error state", async () => {
      await search("guren");
      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      expect((field() as HTMLInputElement).value).toBe("");
      expect(screen.queryByText("Gurenge")).toBeNull();
      expect(mocks.haptics.select).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    });

    it("loads the next page and appends it", async () => {
      mocks.service.searchTracksByTitle.mockResolvedValue(
        page(["A"], { page: 2 }),
      );
      mocks.service.searchTracksByQuery.mockResolvedValue(page(["B"]));
      await search("guren");
      await act(async () => void fireEvent.click(screen.getByText("more")));
      expect(mocks.service.searchTracksByQuery).toHaveBeenCalledWith({
        page: 2,
      });
      expect(screen.getByText("A")).toBeTruthy();
      expect(screen.getByText("B")).toBeTruthy();
    });

    it("does not load more when there is no next page", async () => {
      await search("guren");
      await act(async () => void fireEvent.click(screen.getByText("more")));
      expect(mocks.service.searchTracksByQuery).not.toHaveBeenCalled();
    });

    it("keeps the list and toasts when loading more fails", async () => {
      mocks.service.searchTracksByTitle.mockResolvedValue(
        page(["A"], { page: 2 }),
      );
      mocks.service.searchTracksByQuery.mockRejectedValue(new Error("x"));
      await search("guren");
      await act(async () => void fireEvent.click(screen.getByText("more")));
      expect(mocks.showError).toHaveBeenCalledWith("Search failed", "error");
      expect(screen.getByText("A")).toBeTruthy();
      expect(
        screen.getByTestId("results").getAttribute("data-loading-more"),
      ).toBe("false");
    });

    it("pull-to-refresh re-runs the current query", async () => {
      await search("guren");
      mocks.service.searchTracksByTitle.mockResolvedValue(page(["Fresh"]));
      await act(async () => void fireEvent.click(screen.getByText("refresh")));
      expect(mocks.service.searchTracksByTitle).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Fresh")).toBeTruthy();
      expect(screen.queryByText("Gurenge")).toBeNull();
    });

    it("a failed refresh flags the failure", async () => {
      await search("guren");
      mocks.service.searchTracksByTitle.mockRejectedValue(new Error("x"));
      await act(async () => void fireEvent.click(screen.getByText("refresh")));
      expect(mocks.showError).toHaveBeenCalledWith("Search failed", "error");
      expect(screen.getByText("Retry")).toBeTruthy();
    });
  });

  describe("recent searches", () => {
    beforeEach(() => {
      mocks.recent.recent = [entry("naruto", 169), entry("bleach", 1)];
    });

    /** A row's pick button, found by its accessible label. */
    const row = (label: string) =>
      screen.queryByRole("button", { name: label });

    it("appear while the field is empty, focused or not, instead of the results", () => {
      render(<MakeRequest />);
      expect(row("naruto, 169 results")).toBeTruthy();
      fireEvent.focus(field());
      expect(row("naruto, 169 results")).toBeTruthy();
      expect(row("bleach, 1 result")).toBeTruthy();
      expect(screen.queryByTestId("results")).toBeNull();
    });

    it("show each search's result count", () => {
      render(<MakeRequest />);
      expect(screen.getByText("(169 results)")).toBeTruthy();
      expect(screen.getByText("(1 result)")).toBeTruthy();
      expect(row("naruto, 169 results")).toBeTruthy();
    });

    it("omit the count for entries saved before counts were kept", () => {
      mocks.recent.recent = [entry("naruto", null)];
      render(<MakeRequest />);
      expect(row("naruto")).toBeTruthy();
      expect(screen.queryByText(/results?\)/)).toBeNull();
    });

    it("narrow to the matches while typing, without the Clear action", () => {
      render(<MakeRequest />);
      fireEvent.focus(field());
      type("NAR");
      expect(screen.getByText("Matching recent")).toBeTruthy();
      expect(row("naruto, 169 results")).toBeTruthy();
      expect(row("bleach, 1 result")).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear recent" })).toBeNull();
      // The typed part is emphasized.
      expect(screen.getByText("nar")).toBeTruthy();
    });

    it("offer to run the typed text when nothing matches it", async () => {
      render(<MakeRequest />);
      type("xyz");
      expect(row("naruto, 169 results")).toBeNull();
      expect(screen.queryByText("Matching recent")).toBeNull();
      await act(
        async () =>
          void fireEvent.click(
            screen.getByRole("button", { name: "Search xyz" }),
          ),
      );
      expect(mocks.service.searchTracksByTitle).toHaveBeenCalledWith("xyz");
      expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
    });

    it("hide results for another query while a short edit matches nothing", async () => {
      render(<MakeRequest />);
      await search("guren");
      type("zz");
      expect(screen.queryByTestId("results")).toBeNull();
      expect(screen.getByText("Type at least 3 letters")).toBeTruthy();
    });

    it("collapse Show all again after a trip through the type-ahead", () => {
      mocks.recent.recent = Array.from({ length: 12 }, (_, index) =>
        entry(`q${index}`, 2),
      );
      render(<MakeRequest />);
      fireEvent.click(screen.getByRole("button", { name: "Show all (12)" }));
      type("q1");
      type("");
      expect(row("q11, 2 results")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Show all (12)" }),
      ).toBeTruthy();
    });

    it("undo restores every variant the removal dropped", () => {
      mocks.recent.recent = [entry("Naruto", 3), entry("naruto", 2)];
      render(<MakeRequest />);
      fireEvent.click(screen.getByRole("button", { name: "Remove: Naruto" }));
      toastAction()?.onPress();
      expect(mocks.recent.restoreRecent).toHaveBeenCalledWith([
        entry("Naruto", 3),
        entry("naruto", 2),
      ]);
    });

    it("head the matches with the run row once the text is long enough", () => {
      render(<MakeRequest />);
      type("na");
      expect(row("naruto, 169 results")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Search / })).toBeNull();
      type("nar");
      expect(screen.getByRole("button", { name: "Search nar" })).toBeTruthy();
    });

    it("rank matches from the whole history, strongest first, ten at most", () => {
      mocks.recent.recent = [
        ...Array.from({ length: 12 }, (_, index) =>
          entry(`my love song ${index}`, 1, 100 - index),
        ),
        // The oldest, but the only one that starts with the text.
        entry("lovely", 1, 1),
      ];
      render(<MakeRequest />);
      type("love");
      const rows = screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label") ?? "")
        .filter((label) => label.endsWith(", 1 result"));
      expect(rows).toHaveLength(10);
      expect(rows[0]).toBe("lovely, 1 result");
      expect(rows[1]).toBe("my love song 0, 1 result");
      expect(rows).not.toContain("my love song 9, 1 result");
    });

    it("show ten with an empty field, the rest behind Show all", () => {
      mocks.recent.recent = Array.from({ length: 12 }, (_, index) =>
        entry(`q${index}`, 2),
      );
      render(<MakeRequest />);
      expect(row("q9, 2 results")).toBeTruthy();
      expect(row("q10, 2 results")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Show all (12)" }));
      expect(row("q11, 2 results")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Show less" }));
      expect(row("q11, 2 results")).toBeNull();
    });

    it("come back over stale results while a new query is typed", async () => {
      render(<MakeRequest />);
      await search("guren");
      expect(row("naruto, 169 results")).toBeNull();
      type("naru");
      expect(row("naruto, 169 results")).toBeTruthy();
      expect(screen.queryByTestId("results")).toBeNull();
    });

    it("edit copies one into the field without searching", () => {
      render(<MakeRequest />);
      fireEvent.click(screen.getByRole("button", { name: "Edit: naruto" }));
      expect((field() as HTMLInputElement).value).toBe("naruto");
      expect(mocks.service.searchTracksByTitle).not.toHaveBeenCalled();
      expect(KeyboardController.dismiss).not.toHaveBeenCalled();
    });

    it("picking one fills the field, hides the keyboard and searches", async () => {
      render(<MakeRequest />);
      fireEvent.focus(field());
      await act(async () => void fireEvent.click(row("naruto, 169 results")!));
      expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
      expect(mocks.service.searchTracksByTitle).toHaveBeenCalledWith("naruto");
      expect((field() as HTMLInputElement).value).toBe("naruto");
    });

    /** The action handed to the last toast. */
    const toastAction = () =>
      mocks.showError.mock.lastCall?.[2]?.action as
        { label: string; onPress: () => void } | undefined;

    it("removing one leaves the rest alone, with an Undo", () => {
      render(<MakeRequest />);
      fireEvent.click(screen.getByRole("button", { name: "Remove: naruto" }));
      expect(mocks.recent.removeRecent).toHaveBeenCalledWith("naruto");
      expect(mocks.recent.clearRecent).not.toHaveBeenCalled();
      expect(mocks.showError.mock.lastCall?.[0]).toBe("Removed");
      expect(toastAction()?.label).toBe("Undo");
      toastAction()?.onPress();
      expect(mocks.recent.restoreRecent).toHaveBeenCalledWith([
        entry("naruto", 169),
      ]);
    });

    it("clear wipes the history, with an Undo that brings it all back", () => {
      render(<MakeRequest />);
      fireEvent.focus(field());
      fireEvent.click(screen.getByRole("button", { name: "Clear recent" }));
      expect(mocks.recent.clearRecent).toHaveBeenCalledTimes(1);
      expect(mocks.showError.mock.lastCall?.[0]).toBe("Cleared");
      toastAction()?.onPress();
      expect(mocks.recent.restoreRecent).toHaveBeenCalledWith([
        entry("naruto", 169),
        entry("bleach", 1),
      ]);
    });

    it("are not offered when there is no history", () => {
      mocks.recent.recent = [];
      render(<MakeRequest />);
      fireEvent.focus(field());
      expect(screen.getByTestId("results")).toBeTruthy();
    });
  });

  describe("requesting a track", () => {
    beforeEach(async () => {
      render(<MakeRequest />);
      await search("guren");
    });

    it("opens the sheet for the tapped track and closes it again", () => {
      expect(sheet.props!.visible).toBe(false);
      fireEvent.click(screen.getByText("Gurenge"));
      expect(sheet.props!.visible).toBe(true);
      expect(sheet.props!.track?.id).toBe("Gurenge");
      act(() => sheet.props!.onClose());
      expect(sheet.props!.visible).toBe(false);
    });

    it("ignores taps on tracks that cannot be requested", async () => {
      mocks.service.searchTracksByTitle.mockResolvedValue({
        results: [{ id: "x", title: "Taken", requestable: false }],
      });
      await search("taken");
      fireEvent.click(screen.getByText("Taken (sent)"));
      expect(sheet.props!.visible).toBe(false);
    });

    it("does not open the sheet without a session, shows an error", async () => {
      mocks.user = null;
      mocks.service.searchTracksByTitle.mockResolvedValue({
        results: [{ id: "t1", title: "Gurenge", requestable: true }],
      });
      cleanup();
      render(<MakeRequest />);
      await search("guren");
      fireEvent.click(screen.getByText("Gurenge"));
      expect(sheet.props!.visible).toBe(false);
      expect(mocks.showError).toHaveBeenCalledWith(
        "Sign in to request songs.",
        "error",
      );
      expect(mocks.haptics.error).toHaveBeenCalledTimes(1);
    });

    it("does not open the sheet for an unverified account, explains why", async () => {
      mocks.profile = { user: { verified: false } };
      cleanup();
      render(<MakeRequest />);
      await search("guren");
      fireEvent.click(screen.getByText("Gurenge"));
      expect(sheet.props!.visible).toBe(false);
      expect(mocks.showError).toHaveBeenCalledWith(
        "Needs Discord with 2FA.",
        "error",
      );
      expect(mocks.haptics.error).toHaveBeenCalledTimes(1);
    });

    it("refuses to submit for an unverified account", async () => {
      mocks.profile = { user: { verified: false } };
      cleanup();
      render(<MakeRequest />);
      await expect(sheet.props!.onSubmit("hi")).resolves.toEqual({
        success: false,
        message: "Needs Discord with 2FA.",
      });
      expect(mocks.service.submitRequest).not.toHaveBeenCalled();
    });

    it("refuses to submit without a session", async () => {
      mocks.user = null;
      cleanup();
      render(<MakeRequest />);
      await expect(sheet.props!.onSubmit("hi")).resolves.toEqual({
        success: false,
        message: "Sign in to request songs.",
      });
      expect(mocks.service.submitRequest).not.toHaveBeenCalled();
    });

    it("refuses to submit when no track is selected", async () => {
      await expect(sheet.props!.onSubmit("hi")).resolves.toEqual({
        success: false,
        message: "Pick a track",
      });
    });

    it("submits with the session token and the track's artwork", async () => {
      mocks.service.searchTracksByTitle.mockResolvedValue({
        results: [
          { id: "t1", title: "Gurenge", artwork: "art.jpg", requestable: true },
        ],
      });
      await search("guren!");
      fireEvent.click(screen.getByText("Gurenge"));
      mocks.service.submitRequest.mockResolvedValue({ success: true });
      await expect(sheet.props!.onSubmit("for my friend")).resolves.toEqual({
        success: true,
        message: "Requested!",
      });
      expect(mocks.service.submitRequest).toHaveBeenCalledWith(
        { trackId: "t1", message: "for my friend", sessionId: "sess" },
        // The song's details feed the listen-stats top-requests ranking.
        expect.objectContaining({ artwork: "art.jpg" }),
      );
    });

    it("maps a server rejection to a localized message", async () => {
      fireEvent.click(screen.getByText("Gurenge"));
      mocks.service.submitRequest.mockResolvedValue({
        success: false,
        error: "limit",
        detail: "d",
      });
      await expect(sheet.props!.onSubmit("hi")).resolves.toEqual({
        success: false,
        message: "mapped error",
      });
      expect(mocks.submissionError).toHaveBeenCalledWith("limit", "d", "PT");
    });

    it("marks only the submitted row as no longer requestable", () => {
      act(() => sheet.props!.onRequestSuccess("Gurenge"));
      expect(screen.getByText("Gurenge (sent)")).toBeTruthy();
      expect(screen.getByText("Gurenge 2")).toBeTruthy();
    });
  });
});
