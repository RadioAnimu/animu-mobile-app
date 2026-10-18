// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimuApiError } from "animu-api";

import { ProviderLinkConflict } from "@/core/auth/errors";
import { Account } from "@/screens/Account";

vi.mock("react-native", async () => ({
  ...(await import("@/__tests__/react-native-mock")).createReactNativeMock(),
  Linking: { openURL: vi.fn(() => Promise.resolve()) },
}));
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  showError: vi.fn(),
  haptics: { success: vi.fn(), warning: vi.fn() },
  navigation: { goBack: vi.fn(), navigate: vi.fn(), replace: vi.fn() },
  auth: {} as Record<string, unknown>,
}));

vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast, error: mocks.showError }),
}));
vi.mock("@/contexts/auth/AuthProvider", () => ({ useAuth: () => mocks.auth }));
// The real error classes, without pulling the facade (and its native deps).
vi.mock("@/core/auth", async () => import("@/core/auth/errors"));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/constants/auth", () => ({
  isProviderConfigured: () => true,
  isProviderLinkable: () => true,
}));
vi.mock("@/hooks/useScrollEndPadding", () => ({
  useScrollEndPadding: () => 0,
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    ACCOUNT_TITLE: "Account",
    ACCOUNT_SIGN_IN: "Sign in",
    REQUEST_NEEDS_VERIFIED: "Requests need a verified account",
    ACCOUNT_LINKED_ACCOUNTS: "Linked accounts",
    ACCOUNT_LINKED: "Linked",
    ACCOUNT_NOT_LINKED: "Not linked",
    ACCOUNT_UNLINK: "Unlink",
    ACCOUNT_LINK: "Link",
    ACCOUNT_SHOW: "Show",
    ACCOUNT_HIDE: "Hide",
    ACCOUNT_CANCEL: "Cancel",
    ACCOUNT_LINK_SUCCESS: "Account linked",
    ACCOUNT_LINK_CONFLICT: "{provider} is already linked elsewhere.",
    ACCOUNT_LAST_PROVIDER: "Keep one linked account.",
    ACCOUNT_ACTION_FAILED: "Action failed.",
    ACCOUNT_UNLINK_SUCCESS: "Account unlinked",
    ACCOUNT_UNLINK_CONFIRM_TITLE: "Unlink {provider}?",
    ACCOUNT_UNLINK_CONFIRM_MSG: "You can't sign in with {provider}.",
    ACCOUNT_UNLINK_DISCORD_WARNING: "Song requests will turn off.",
    ACCOUNT_REQUESTS_TITLE: "Song requests",
    ACCOUNT_REQUESTS_READY: "Song requests are on",
    ACCOUNT_REQUESTS_READY_DESC: "Verified.",
    ACCOUNT_REQUESTS_DISCORD: "Discord account",
    ACCOUNT_REQUESTS_2FA: "2FA on Discord",
    ACCOUNT_REQUESTS_2FA_OFF: "Not turned on yet",
    ACCOUNT_REQUESTS_LINK_FIRST: "Link Discord first",
    ACCOUNT_REQUESTS_LINK_DISCORD: "Link Discord",
    ACCOUNT_REQUESTS_2FA_HELP: "How to turn on 2FA",
    ACCOUNT_REQUESTS_2FA_HELP_DESC: "Opens help",
    ACCOUNT_REQUESTS_REFRESH: "Check again",
    ACCOUNT_REQUESTS_REFRESH_DESC: "Refresh your status.",
    ACCOUNT_REQUESTS_NOW_ON: "You're verified!",
    ACCOUNT_REQUESTS_STILL_OFF: "Still off.",
    ACCOUNT_ANIMU_CONNECT: "Animu Connect",
    ACCOUNT_ANIMU_CONNECT_DESC: "Email sign-in",
    ACCOUNT_LOGOUT: "Log out",
    ACCOUNT_LOGOUT_DESC: "This device only",
    ACCOUNT_DANGER: "Danger zone",
    ACCOUNT_DELETE: "Delete account",
    ACCOUNT_DELETE_DESC: "Permanent",
  }),
}));
vi.mock("@/components/SectionTitle", () => ({
  SectionTitle: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
vi.mock("@/components/ScreenHeader", () => ({
  ScreenHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock("@/components/AccountEmails", () => ({ AccountEmails: () => <i /> }));
vi.mock("@/components/AppRefreshControl", () => ({
  AppRefreshControl: () => <i />,
}));
vi.mock("@/components/KeyboardScrollView", () => ({
  KeyboardScrollView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/screens/Account/ProfileCard", () => ({ ProfileCard: () => <i /> }));
vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ provider }: { provider: string }) => (
    <i data-provider={provider} />
  ),
}));
vi.mock("@/components/MaskedValue", () => ({
  MaskedValue: ({ value }: { value: string }) => <span>{value}</span>,
}));

const NAV = mocks.navigation as never;

const profileOf = (verified: boolean, linked: string[]) => ({
  user: { verified },
  linkedProviders: linked.map((provider) => ({ provider })),
});

function signIn(
  verified: boolean,
  linked: string[],
  over: Record<string, unknown> = {},
) {
  mocks.auth = {
    user: { username: "ana" },
    profile: profileOf(verified, linked),
    providers: [
      { name: "google", label: "Google" },
      { name: "discord", label: "Discord" },
    ],
    isAuthenticated: true,
    imageVersion: 0,
    media: { banner: null },
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    refreshProfile: vi.fn(async () => profileOf(verified, linked)),
    linkProvider: vi.fn(async () => {}),
    unlinkProvider: vi.fn(async () => {}),
    ...over,
  };
}

const renderAccount = () => render(<Account navigation={NAV} route={{} as never} />);

/** The confirm dialog's [title, message, buttons] from the last Alert.alert. */
const lastAlert = () =>
  vi.mocked(Alert.alert).mock.calls.at(-1) as unknown as [
    string,
    string,
    { text: string; onPress?: () => void }[],
  ];

describe("Account", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  describe("signed out", () => {
    beforeEach(() => {
      mocks.auth = { user: null, profile: null, isAuthenticated: false };
    });

    it("has no signed-out page: it goes straight to Login", () => {
      renderAccount();
      expect(mocks.navigation.replace).toHaveBeenCalledExactlyOnceWith("Login");
      expect(screen.queryByText("Linked accounts")).toBeNull();
    });
  });

  it("log out lands on Login once, not again when the session clears", async () => {
    signIn(true, ["discord"], {
      logout: vi.fn(async () => {
        mocks.auth = { user: null, profile: null, isAuthenticated: false };
      }),
    });
    const { rerender } = renderAccount();

    // fireEvent runs inside act; waitFor absorbs the async logout promise
    // (which navigates itself) so the rerender below sees the settled state.
    fireEvent.click(screen.getByRole("button", { name: /^Log out/ }));
    await waitFor(() =>
      expect(mocks.navigation.replace).toHaveBeenCalledWith("Login"),
    );
    rerender(<Account navigation={NAV} route={{} as never} />);

    expect(mocks.navigation.replace).toHaveBeenCalledExactlyOnceWith("Login");
  });

  it("swaps to Login when the session is lost while the page is open", () => {
    signIn(true, ["discord"]);
    const { rerender } = renderAccount();
    expect(mocks.navigation.replace).not.toHaveBeenCalled();

    mocks.auth = { user: null, profile: null, isAuthenticated: false };
    rerender(<Account navigation={NAV} route={{} as never} />);

    expect(mocks.navigation.replace).toHaveBeenCalledExactlyOnceWith("Login");
  });

  describe("signed in", () => {
    it("orders the sections requests → linked → connect → logout → danger", () => {
      signIn(false, ["google"]);
      renderAccount();
      const order = [
        "Song requests",
        "Linked accounts",
        "Animu Connect",
        "Log out, This device only",
        "Danger zone",
      ].map((name) => {
        const el =
          screen.queryByText(name) ??
          screen.getByRole("button", { name });
        return el;
      });
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(
        screen.getByRole("button", { name: "Delete account, Permanent" }),
      ).toBeTruthy();
    });

    it("the requests link row runs the same link flow as Linked accounts", async () => {
      signIn(false, ["google"]);
      renderAccount();

      // Two "Link Discord" buttons: the requests row first, then the account row.
      const [requestsRow] = screen.getAllByRole("button", {
        name: "Link Discord",
      });
      fireEvent.click(requestsRow);
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith("Account linked"),
      );
      expect(mocks.auth.linkProvider).toHaveBeenCalledExactlyOnceWith(
        "discord",
      );
      expect(mocks.toast).toHaveBeenCalledWith("Account linked");
    });

    it("refresh: celebrates when the account is now verified", async () => {
      signIn(false, ["discord"], {
        refreshProfile: vi.fn(async () => profileOf(true, ["discord"])),
      });
      renderAccount();

      fireEvent.click(screen.getByRole("button", { name: /^Check again/ }));
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith("You're verified!"),
      );
      expect(mocks.auth.refreshProfile).toHaveBeenCalledTimes(1);
      expect(mocks.haptics.success).toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledWith("You're verified!");
    });

    it("blocks the other account actions while one is running", async () => {
      let finish: () => void = () => {};
      signIn(false, ["discord"], {
        refreshProfile: vi.fn(
          () =>
            new Promise((resolve) => {
              finish = () => resolve(profileOf(false, ["discord"]));
            }),
        ),
      });
      renderAccount();

      // fireEvent already runs the event inside act, so `busy` is flushed
      // synchronously; the pending promise is deliberately left unsettled.
      fireEvent.click(screen.getByRole("button", { name: /^Check again/ }));
      for (const name of [/^Log out/, /^Delete account/]) {
        expect(
          screen.getByRole("button", { name }).getAttribute("aria-disabled"),
        ).toBe("true");
      }

      await act(async () => {
        finish();
      });
      expect(
        screen
          .getByRole("button", { name: /^Log out/ })
          .getAttribute("aria-disabled"),
      ).not.toBe("true");
    });

    it("refresh: says so when 2FA is still off", async () => {
      signIn(false, ["discord"]);
      renderAccount();

      fireEvent.click(screen.getByRole("button", { name: /^Check again/ }));
      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith("Still off.", "info"),
      );
      expect(mocks.haptics.success).not.toHaveBeenCalled();
    });

    it("maps the typed link conflict to the provider-named message", async () => {
      signIn(false, ["google"], {
        linkProvider: vi.fn(async () => {
          throw new ProviderLinkConflict("discord");
        }),
      });
      renderAccount();

      const [, accountRow] = screen.getAllByRole("button", {
        name: "Link Discord",
      });
      fireEvent.click(accountRow);
      await waitFor(() => expect(mocks.showError).toHaveBeenCalled());
      expect(mocks.showError).toHaveBeenCalledExactlyOnceWith(
        "Discord is already linked elsewhere.",
      );
    });

    it("keeps last_provider on its own message and the rest generic", async () => {
      const unlinkProvider = vi
        .fn()
        .mockRejectedValueOnce(
          new AnimuApiError("last", 409, {}, "last_provider"),
        )
        .mockRejectedValueOnce(new Error("boom"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      signIn(false, ["google", "discord"], { unlinkProvider });
      renderAccount();

      for (const expected of ["Keep one linked account.", "Action failed."]) {
        fireEvent.click(screen.getByRole("button", { name: "Unlink Google" }));
        await act(async () => lastAlert()[2][1].onPress?.());
        expect(mocks.showError).toHaveBeenLastCalledWith(expected);
      }
    });

    it("unlinking Discord while verified warns that requests turn off", () => {
      signIn(true, ["google", "discord"]);
      renderAccount();

      fireEvent.click(screen.getByRole("button", { name: "Unlink Discord" }));
      const [title, message] = lastAlert();
      expect(title).toBe("Unlink Discord?");
      expect(message).toBe(
        "You can't sign in with Discord.\n\nSong requests will turn off.",
      );
    });

    it("no warning for Discord when unverified, or for other providers", () => {
      signIn(false, ["google", "discord"]);
      renderAccount();
      fireEvent.click(screen.getByRole("button", { name: "Unlink Discord" }));
      expect(lastAlert()[1]).toBe("You can't sign in with Discord.");
      cleanup();

      signIn(true, ["google", "discord"]);
      renderAccount();
      fireEvent.click(screen.getByRole("button", { name: "Unlink Google" }));
      expect(lastAlert()[1]).toBe("You can't sign in with Google.");
    });
  });
});
