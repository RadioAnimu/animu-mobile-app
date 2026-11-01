// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomDrawerContent } from "@/components/CustomDrawer";
import { onReselect } from "@/core/navigation/reselect";
import { THEME } from "@/theme";
import { WINDOW_CONTROLS_HEIGHT, type ResponsiveLayout } from "@/theme/layout";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("@/components/Logo", () => ({
  Logo: () => <span data-testid="logo" />,
}));
const drawerStatus = vi.hoisted(() => ({ value: "open" as "open" | "closed" }));
vi.mock("@react-navigation/drawer", () => ({
  useDrawerStatus: () => drawerStatus.value,
  DrawerContentScrollView: ({
    children,
    contentContainerStyle,
  }: {
    children: React.ReactNode;
    contentContainerStyle?: Record<string, unknown>;
  }) => (
    <div data-content-style={JSON.stringify(contentContainerStyle ?? {})}>
      {children}
    </div>
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

/** Mutable stand-in for the window's safe-area insets. */
const insetsCtl = vi.hoisted(() => ({
  value: { top: 0, bottom: 0, left: 0, right: 0 },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => insetsCtl.value,
}));

const mocks = vi.hoisted(() => ({
  auth: {} as { user?: object | null; profile?: object | null },
  haptics: { select: vi.fn(), error: vi.fn() },
  player: { currentProgram: undefined } as {
    currentProgram?: { isLive: boolean };
  },
  toast: vi.fn(),
  /** The window's layout; each test sets it before rendering (phone by default). */
  layout: null as unknown as ResponsiveLayout,
}));

vi.mock("@/hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => mocks.layout,
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
    ACCOUNT_SIGN_IN: "Sign in",
    SETTINGS_TITLE: "Settings",
    SETTINGS_ACCOUNT_SIGN_IN: "Sign in to sync",
    ACCOUNT_TITLE: "Account",
    A11Y_OPENS_SETTINGS: "opens settings",
    A11Y_OPENS_LOGIN: "opens login",
    A11Y_OPENS_ACCOUNT: "opens account",
    REQUEST_ERROR_ONAIR: "Requests are disabled while a DJ is live.",
  }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: mocks.haptics }));
vi.mock("@/components/Avatar", () => ({
  Avatar: ({ uri }: { uri: string }) => (
    <i data-testid="avatar" data-uri={uri} />
  ),
}));

const navigation = { navigate: vi.fn(), dispatch: vi.fn(), closeDrawer: vi.fn() };

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

/** A portrait phone: no window controls over the drawer's top corner. */
const PHONE: ResponsiveLayout = {
  width: 393,
  height: 852,
  usableWidth: 393,
  windowClass: "compact",
  landscape: false,
  split: false,
  short: false,
  windowControlsInset: 0,
};

describe("CustomDrawerContent", () => {
  beforeEach(() => {
    mocks.auth = { user: null, profile: null };
    mocks.player = { currentProgram: undefined };
    mocks.layout = { ...PHONE, windowControlsInset: 0 };
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  describe("safe area", () => {
    it("keeps the menu clear of the landscape (left) inset", () => {
      insetsCtl.value = { top: 24, bottom: 49, left: 47, right: 0 };
      render(<CustomDrawerContent {...makeProps()} />);
      const content = document.querySelector("[data-content-style]")!;
      expect(JSON.parse(content.getAttribute("data-content-style")!)).toEqual({
        flexGrow: 1,
        paddingLeft: 47,
      });
    });

    it("changes nothing on a portrait phone, where the side insets are 0", () => {
      insetsCtl.value = { top: 59, bottom: 34, left: 0, right: 0 };
      render(<CustomDrawerContent {...makeProps()} />);
      const content = document.querySelector("[data-content-style]")!;
      expect(JSON.parse(content.getAttribute("data-content-style")!)).toEqual({
        flexGrow: 1,
        paddingLeft: 0,
      });
    });
  });

  describe("window controls", () => {
    /** The header View — the parent of the logo (Animu) button. */
    const headerStyle = () =>
      JSON.parse(
        screen.getByRole("button", { name: "Animu" }).parentElement!.getAttribute("data-style")!,
      );

    it("keeps the header's designed margin on a phone", () => {
      render(<CustomDrawerContent {...makeProps()} />);
      expect(headerStyle().marginTop).toBe(THEME.SPACE.MD);
    });

    it("drops the logo below the iPadOS window controls in a resizable window", () => {
      mocks.layout = { ...PHONE, windowControlsInset: 72 };
      render(<CustomDrawerContent {...makeProps()} />);
      expect(headerStyle().marginTop).toBe(WINDOW_CONTROLS_HEIGHT);
    });
  });

  describe("account row", () => {
    it("signed out: invites sign-in, opens Login, and offers a separate settings gear", () => {
      render(<CustomDrawerContent {...makeProps()} />);
      expect(screen.getByText("Sign in to sync")).toBeTruthy();
      expect(screen.getByText("Sign in")).toBeTruthy();
      expect(screen.queryByTestId("avatar")).toBeNull();

      fireEvent.click(screen.getByText("Sign in"));
      expect(navigation.closeDrawer).toHaveBeenCalled();
      expect(navigation.navigate).toHaveBeenCalledWith("Login");

      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(navigation.closeDrawer).toHaveBeenCalled();
      expect(navigation.navigate).toHaveBeenCalledWith("Settings");
    });

    it("signed in: shows name and @handle; the chip opens Account, the gear Settings", () => {
      mocks.auth = { user, profile: null };
      render(<CustomDrawerContent {...makeProps()} />);
      expect(screen.getByText("ana_u")).toBeTruthy();
      expect(screen.getByText("@ana")).toBeTruthy();
      expect(screen.getByTestId("avatar").getAttribute("data-uri")).toBe(
        user.avatarUrl,
      );

      fireEvent.click(screen.getByText("ana_u"));
      expect(navigation.closeDrawer).toHaveBeenCalled();
      expect(navigation.navigate).toHaveBeenCalledWith("Account");

      vi.clearAllMocks();
      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(navigation.closeDrawer).toHaveBeenCalled();
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

describe("CustomDrawerContent — keyboard focus", () => {
  afterEach(() => {
    drawerStatus.value = "open";
  });

  it("takes none of its controls into focus while closed (it stays mounted off-screen)", () => {
    drawerStatus.value = "closed";
    const { container } = render(<CustomDrawerContent {...makeProps()} />);
    const focusables = container.querySelectorAll("[data-focusable]");
    expect(focusables.length).toBeGreaterThan(0);
    focusables.forEach((node) => expect(node.getAttribute("data-focusable")).toBe("false"));
  });

  it("takes its controls into focus once open", () => {
    const { container } = render(<CustomDrawerContent {...makeProps()} />);
    container
      .querySelectorAll("[data-focusable]")
      .forEach((node) => expect(node.getAttribute("data-focusable")).toBe("true"));
  });
});
