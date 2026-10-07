// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoutes } from "@/routes/app.routes";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

interface ScreenProps {
  name: string;
  component: unknown;
  initialParams?: unknown;
  options: {
    drawerLabel?: string;
    drawerIcon?: (args: { color: string }) => ReactNode;
    drawerItemStyle?: { display: string };
  };
}
interface NavigatorProps {
  screenOptions: {
    headerShown: boolean;
    drawerStyle: { width: number };
  };
  drawerContent: (props: { marker: string }) => ReactNode;
  children: ReactNode;
}

interface StackScreenProps {
  name: string;
  component: unknown;
  options?: { contentStyle?: { backgroundColor: string }; presentation?: string; animation?: string };
}
interface StackNavigatorProps {
  screenOptions: { headerShown: boolean; animation: string };
  children: ReactNode;
}

const captured = vi.hoisted(() => ({
  screens: [] as ScreenProps[],
  navigator: null as NavigatorProps | null,
  stackScreens: [] as StackScreenProps[],
  stack: null as StackNavigatorProps | null,
  reduceMotion: false,
}));

vi.mock("@react-navigation/drawer", () => ({
  createDrawerNavigator: () => ({
    Navigator: (props: NavigatorProps) => {
      captured.navigator = props;
      return <div data-testid="navigator">{props.children}</div>;
    },
    Screen: (props: ScreenProps) => {
      captured.screens.push(props);
      return null;
    },
  }),
}));
vi.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: (props: StackNavigatorProps) => {
      captured.stack = props;
      return <div data-testid="stack">{props.children}</div>;
    },
    Screen: (props: StackScreenProps) => {
      captured.stackScreens.push(props);
      // Render the drawer root so its screens register too.
      if (props.name === "Main") {
        const Root = props.component as () => ReactNode;
        return <Root />;
      }
      return null;
    },
  }),
}));
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => captured.reduceMotion,
}));
vi.mock("@/components/CustomDrawer", () => ({
  CustomDrawerContent: ({ marker }: { marker: string }) => (
    <div data-testid="drawer-content">{marker}</div>
  ),
  DrawerIcon: ({ name, color }: { name: string; color: string }) => (
    <i data-testid="drawer-icon" data-name={name} data-color={color} />
  ),
}));
vi.mock("@/screens/MakeRequest", () => ({ MakeRequest: () => null }));
vi.mock("@/screens/Home", () => ({ Home: () => null }));
vi.mock("@/screens/History", () => ({ History: () => null }));
vi.mock("@/screens/Settings", () => ({ Settings: () => null }));
vi.mock("@/screens/Stats", () => ({ Stats: () => null }));
vi.mock("@/screens/Storage", () => ({ Storage: () => null }));
vi.mock("@/screens/Login", () => ({ Login: () => null }));
vi.mock("@/screens/Account", () => ({ Account: () => null }));
vi.mock("@/screens/About", () => ({ About: () => null }));
vi.mock("@/screens/Lyrics", () => ({ Lyrics: () => null }));

vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({
    MENU_PLAYER: "Player",
    MENU_LAST_REQUESTED: "Last requested",
    MENU_LAST_PLAYED: "Last played",
    MENU_MAKE_REQUEST: "Make request",
  }),
}));

const byName = (name: string) => captured.screens.find((s) => s.name === name)!;

describe("AppRoutes", () => {
  beforeEach(() => {
    captured.screens.length = 0;
    captured.navigator = null;
    captured.stackScreens.length = 0;
    captured.stack = null;
    captured.reduceMotion = false;
  });
  afterEach(cleanup);

  it("puts the four destinations in the drawer, in order", () => {
    render(<AppRoutes />);
    expect(captured.screens.map((s) => s.name)).toEqual([
      "Home",
      "LastRequested",
      "LastPlayed",
      "MakeRequest",
    ]);
  });

  it("pushes the detail pages on a native stack over the drawer", () => {
    render(<AppRoutes />);
    expect(captured.stackScreens.map((s) => s.name)).toEqual([
      "Main",
      "Settings",
      "Stats",
      "Storage",
      "Login",
      "Account",
      "About",
      "Lyrics",
    ]);
    expect(captured.stack!.screenOptions.headerShown).toBe(false);
  });

  it("raises the lyrics over the player (a fade with Reduce Motion)", () => {
    render(<AppRoutes />);
    const lyrics = captured.stackScreens.find((s) => s.name === "Lyrics")!;
    expect(lyrics.options?.presentation).toBe("fullScreenModal");
    expect(lyrics.options?.animation).toBe("slide_from_bottom");
    cleanup();
    captured.reduceMotion = true;
    render(<AppRoutes />);
    const reduced = captured.stackScreens.filter((s) => s.name === "Lyrics").at(-1)!;
    expect(reduced.options?.animation).toBe("fade");
  });

  it("uses the platform push, or a cross-fade with Reduce Motion", () => {
    render(<AppRoutes />);
    expect(captured.stack!.screenOptions.animation).toBe("default");
    cleanup();
    captured.reduceMotion = true;
    render(<AppRoutes />);
    expect(captured.stack!.screenOptions.animation).toBe("fade");
  });

  it("keeps the drawer root transparent over the app artwork", () => {
    render(<AppRoutes />);
    const main = captured.stackScreens.find((s) => s.name === "Main")!;
    expect(main.options?.contentStyle?.backgroundColor).toBe("transparent");
  });

  it("sizes the drawer to 80% of the window and hides the header", () => {
    render(<AppRoutes />);
    expect(captured.navigator!.screenOptions.headerShown).toBe(false);
    // The RN mock's window is 393 wide.
    expect(captured.navigator!.screenOptions.drawerStyle.width).toBeCloseTo(393 * 0.8);
  });

  it("renders the custom drawer content with the navigator's props", () => {
    render(<AppRoutes />);
    render(<>{captured.navigator!.drawerContent({ marker: "from-navigator" })}</>);
    expect(screen.getByTestId("drawer-content").textContent).toBe("from-navigator");
  });

  it("keeps the drawer content renderer stable across renders (no remounts)", () => {
    const { rerender } = render(<AppRoutes />);
    const first = captured.navigator!.drawerContent;
    rerender(<AppRoutes />);
    expect(captured.navigator!.drawerContent).toBe(first);
  });

  it.each([
    ["Home", "Player", "play-circle"],
    ["LastRequested", "Last requested", "queue-music"],
    ["LastPlayed", "Last played", "history"],
    ["MakeRequest", "Make request", "music-note"],
  ])("%s has a drawer entry with label and tinted icon", (name, label, icon) => {
    render(<AppRoutes />);
    const { options } = byName(name);
    expect(options.drawerLabel).toBe(label);
    render(<>{options.drawerIcon!({ color: "#abc" })}</>);
    const rendered = screen.getByTestId("drawer-icon");
    expect(rendered.getAttribute("data-name")).toBe(icon);
    expect(rendered.getAttribute("data-color")).toBe("#abc");
  });

  it("opens the history screen on the matching history type", () => {
    render(<AppRoutes />);
    expect(byName("LastRequested").initialParams).toEqual({ historyType: "requests" });
    expect(byName("LastPlayed").initialParams).toEqual({ historyType: "played" });
  });
});
