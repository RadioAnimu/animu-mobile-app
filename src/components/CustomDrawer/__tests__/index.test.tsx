// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomDrawerContent } from "@/components/CustomDrawer";
import { onReselect } from "@/core/navigation/reselect";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("@/components/Logo", () => ({
  Logo: () => <span data-testid="logo" />,
}));
vi.mock("@react-navigation/drawer", () => ({
  DrawerContentScrollView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@react-navigation/native", () => ({
  CommonActions: {
    navigate: (name: string, params?: object) => ({
      type: "NAVIGATE",
      name,
      params,
    }),
  },
  DrawerActions: { closeDrawer: () => ({ type: "CLOSE_DRAWER" }) },
}));

const mocks = vi.hoisted(() => ({
  auth: {} as { user?: object | null; profile?: object | null },
  haptics: { select: vi.fn(), error: vi.fn() },
  player: { currentProgram: undefined } as {
    currentProgram?: { isLive: boolean };
  },
  toast: vi.fn(),
}));

vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => mocks.player,
}));
vi.mock("@/contexts/alert/AlertProvider", () => ({
  useAlert: () => ({ toast: mocks.toast }),
}));

vi.mock("@/contexts/auth/AuthProvider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    MENU: "Menu",
    LOGIN_WORD: "Login",
    SETTINGS_TITLE: "Settings",
    SETTINGS_ACCOUNT_SIGN_IN: "Sign in to sync",
    ACCOUNT_TITLE: "Account",
    A11Y_OPENS_SETTINGS: "opens settings",
    A11Y_OPENS_LOGIN: "opens login",
    REQUEST_ERROR_ONAIR: "Requests are disabled while a DJ is live.",
  }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/components/Avatar", () => ({
  Avatar: ({ uri }: { uri: string }) => (
    <i data-testid="avatar" data-uri={uri} />
  ),
}));

const navigation = { navigate: vi.fn(), dispatch: vi.fn() };

function makeProps(focusedIndex = 0): DrawerContentComponentProps {
  const routes = [
    { key: "home", name: "Home", params: undefined },
    { key: "played", name: "LastPlayed", params: { kind: "played" } },
    { key: "settings", name: "Settings", params: undefined },
    { key: "request", name: "MakeRequest", params: undefined },
  ];
  const descriptors = {
    home: {
      options: {
        drawerLabel: "Player",
        drawerIcon: () => <i data-testid="icon-home" />,
      },
    },
    played: { options: { title: "Played fallback" } },
    settings: { options: { drawerItemStyle: { display: "none" } } },
    request: { options: { drawerLabel: "Make request" } },
  };
  return {
    state: { key: "drawer-1", index: focusedIndex, routes },
    descriptors,
    navigation,
  } as unknown as DrawerContentComponentProps;
}

const user = { username: "ana_u", handle: "ana", avatarUrl: "https://a/x.png" };

describe("CustomDrawerContent", () => {
  beforeEach(() => {
    mocks.auth = { user: null, profile: null };
    mocks.player = { currentProgram: undefined };
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  describe("account row", () => {
    it("signed out: invites sign-in, opens Login, and offers a separate settings gear", () => {
      render(<CustomDrawerContent {...makeProps()} />);
      expect(screen.getByText("Sign in to sync")).toBeTruthy();
      expect(screen.getByText("Login")).toBeTruthy();
      expect(screen.queryByTestId("avatar")).toBeNull();

      fireEvent.click(screen.getByText("Login"));
      expect(navigation.navigate).toHaveBeenCalledWith("Login");

      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(navigation.navigate).toHaveBeenCalledWith("Settings");
    });

    it("signed in: shows name and @handle, opens Settings, no gear", () => {
      mocks.auth = { user, profile: null };
      render(<CustomDrawerContent {...makeProps()} />);
      expect(screen.getByText("ana_u")).toBeTruthy();
      expect(screen.getByText("@ana")).toBeTruthy();
      expect(screen.getByTestId("avatar").getAttribute("data-uri")).toBe(
        user.avatarUrl,
      );
      expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();

      fireEvent.click(screen.getByText("ana_u"));
      expect(navigation.navigate).toHaveBeenCalledWith("Settings");
    });

    it("signed in without a handle: captions with the account title", () => {
      mocks.auth = { user: { ...user, handle: null }, profile: null };
      render(<CustomDrawerContent {...makeProps()} />);
      expect(screen.getByText("Account")).toBeTruthy();
    });
  });

  describe("navigation items", () => {
    it("lists visible routes with label, title fallback and icon; hides display:none ones", () => {
      render(<CustomDrawerContent {...makeProps()} />);
      expect(screen.getByText("Player")).toBeTruthy();
      expect(screen.getByText("Played fallback")).toBeTruthy();
      expect(screen.getByTestId("icon-home")).toBeTruthy();
      // The hidden route never shows as a nav item (only as the account gear/name).
      expect(screen.queryByText("Settings")).toBeNull();
      expect(screen.getByText("MENU")).toBeTruthy();
    });

    it("marks the focused route as selected", () => {
      render(<CustomDrawerContent {...makeProps(0)} />);
      expect(
        screen
          .getByText("Player")
          .closest("[role=button]")!
          .getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        screen
          .getByText("Played fallback")
          .closest("[role=button]")!
          .getAttribute("aria-selected"),
      ).toBe("false");
    });

    it("navigates to another route with its params and a haptic tick", () => {
      render(<CustomDrawerContent {...makeProps(0)} />);
      fireEvent.click(screen.getByText("Played fallback"));
      expect(mocks.haptics.select).toHaveBeenCalledTimes(1);
      expect(navigation.dispatch).toHaveBeenCalledExactlyOnceWith({
        type: "NAVIGATE",
        name: "LastPlayed",
        params: { kind: "played" },
        target: "drawer-1",
      });
    });

    it("re-tapping the focused route closes the drawer and signals a scroll-to-top", () => {
      const reselected = vi.fn();
      const off = onReselect("Home", reselected);
      render(<CustomDrawerContent {...makeProps(0)} />);
      fireEvent.click(screen.getByText("Player"));
      expect(reselected).toHaveBeenCalledTimes(1);
      expect(navigation.dispatch).toHaveBeenCalledExactlyOnceWith({
        type: "CLOSE_DRAWER",
        target: "drawer-1",
      });
      off();
    });

    it("make request is usable while the AutoDJ is on air", () => {
      render(<CustomDrawerContent {...makeProps(0)} />);
      const item = screen.getByText("Make request").closest("[role=button]")!;
      expect(item.getAttribute("aria-disabled")).not.toBe("true");
      fireEvent.click(item);
      expect(navigation.dispatch).toHaveBeenCalledExactlyOnceWith({
        type: "NAVIGATE",
        name: "MakeRequest",
        params: undefined,
        target: "drawer-1",
      });
    });

    it("make request is locked during a live show: no navigation, explains why", () => {
      mocks.player = { currentProgram: { isLive: true } };
      render(<CustomDrawerContent {...makeProps(0)} />);
      const item = screen.getByText("Make request").closest("[role=button]")!;
      expect(item.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(item);
      expect(navigation.dispatch).not.toHaveBeenCalled();
      expect(mocks.toast).toHaveBeenCalledWith(
        "Requests are disabled while a DJ is live.",
        "error",
      );
      // Other items stay usable.
      fireEvent.click(screen.getByText("Played fallback"));
      expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    });

    it("the logo goes Home", () => {
      render(<CustomDrawerContent {...makeProps(1)} />);
      fireEvent.click(screen.getByRole("button", { name: "Animu" }));
      expect(navigation.navigate).toHaveBeenCalledWith("Home");
    });
  });
});
