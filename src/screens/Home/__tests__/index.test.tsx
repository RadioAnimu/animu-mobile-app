// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Home } from "@/screens/Home";
import { resolveLayout } from "@/theme/layout";

vi.mock("react-native", async () => ({
  ...(await import("@/__tests__/react-native-mock")).createReactNativeMock(),
  // Surfaces the content container's style, which the generic mock drops.
  ScrollView: ({ children, contentContainerStyle }: Record<string, any>) => (
    <div data-testid="scroll" data-content={JSON.stringify(contentContainerStyle ?? null)}>
      {children}
    </div>
  ),
}));
vi.mock("expo-image", () => ({
  Image: ({ source }: { source: { uri: string } }) => <img alt="" src={source.uri} />,
}));

const mocks = vi.hoisted(() => ({
  layout: {} as ReturnType<typeof import("@/theme/layout").resolveLayout>,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  player: {} as Record<string, unknown>,
}));

vi.mock("@/hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => mocks.layout,
}));
vi.mock("@/hooks/useRouteReselect", () => ({ useRouteReselect: () => undefined }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: unknown }) => <main>{children as never}</main>,
  useSafeAreaInsets: () => mocks.insets,
}));
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => mocks.player,
}));

vi.mock("@/components/HeaderBar", () => ({
  HeaderBar: ({ rowWidth }: { rowWidth?: number }) => (
    <header data-testid="header" data-row-width={rowWidth ?? ""} />
  ),
}));
vi.mock("@/components/LiveRequestModal", () => ({ LiveRequestModal: () => null }));
vi.mock("@/components/PopUpProgram", () => ({ PopUpProgram: () => null }));
vi.mock("@/components/Listeners", () => ({ Listeners: () => <i data-testid="listeners" /> }));
vi.mock("@/components/Live", () => ({ Live: () => <i data-testid="live" /> }));
vi.mock("@/components/Program", () => ({ Program: () => <i data-testid="program" /> }));
vi.mock("@/components/TimeRemaining", () => ({ TimeRemaining: () => <i data-testid="time" /> }));
vi.mock("@/components/ChooseBitrateSection", () => ({ ChooseBitrateSection: () => <i data-testid="bitrate" /> }));
vi.mock("@/components/TrackCover", () => ({
  TrackCover: ({ size }: { size?: number }) => <i data-testid="cover" data-size={size ?? ""} />,
}));
vi.mock("@/components/Logo", () => ({
  Logo: ({ size }: { size?: number }) => <i data-testid="logo" data-size={size} />,
}));
vi.mock("@/components/Oscilloscope", () => ({
  Oscilloscope: ({ width, height }: { width?: number; height?: number }) => (
    <i data-testid="scope" data-width={width ?? ""} data-height={height ?? ""} />
  ),
}));

const PHONE_INSETS = { top: 0, right: 59, bottom: 21, left: 59 };
const IPAD_INSETS = { top: 24, right: 0, bottom: 20, left: 0 };

const setWindow = (
  width: number,
  height: number,
  insets = { top: 0, right: 0, bottom: 0, left: 0 },
) => {
  mocks.insets = insets;
  mocks.layout = resolveLayout(width, height, insets);
};

const order = () =>
  [...document.querySelectorAll("[data-testid]")]
    .map((el) => el.getAttribute("data-testid"))
    .filter((id) => id !== "scroll" && id !== "header");

const content = () => JSON.parse(screen.getByTestId("scroll").getAttribute("data-content")!);
const BANNER = { name: "Hora do Anime", imageUrl: "https://cdn.animu.test/banner.jpg" };

describe("Home", () => {
  beforeEach(() => {
    mocks.player = { currentProgram: BANNER };
    setWindow(393, 852);
  });
  afterEach(cleanup);

  describe("portrait stack", () => {
    it("renders the single column in its original order, top-aligned", () => {
      render(<Home />);
      expect(order()).toEqual([
        "scope",
        "logo",
        "listeners",
        "cover",
        "time",
        "live",
        "program",
        "bitrate",
      ]);
      expect(content()).toBeNull();
      // The stack's art is the default square: no size handed down.
      expect(screen.getByTestId("cover").getAttribute("data-size")).toBe("");
      expect(screen.getByTestId("scope").getAttribute("data-width")).toBe("");
      expect(screen.getByTestId("header").getAttribute("data-row-width")).toBe("");
      expect(screen.queryByRole("button", { name: BANNER.name })).toBeNull();
    });

    it("centers a tablet's tall portrait window, but still shows no banner", () => {
      setWindow(820, 1180, IPAD_INSETS);
      render(<Home />);
      expect(content()).toEqual({ flexGrow: 1, justifyContent: "center" });
      expect(order()).toContain("live");
      expect(screen.queryByRole("button", { name: BANNER.name })).toBeNull();
    });
  });

  describe("split panes", () => {
    const panesOf = () => {
      const art = screen.getByTestId("listeners").parentElement!.parentElement!;
      return { art, info: screen.getByTestId("program").parentElement!.parentElement!, row: art.parentElement! };
    };

    it("puts program info and artwork side by side with the ticker below both", () => {
      setWindow(1180, 820, IPAD_INSETS);
      render(<Home />);
      const { art, info, row } = panesOf();
      expect(JSON.parse(row.getAttribute("data-style")!).flexDirection).toBe("row");
      expect([...row.children]).toEqual([info, art]);
      expect(info.contains(screen.getByTestId("scope"))).toBe(true);
      expect(info.contains(screen.getByTestId("bitrate"))).toBe(true);
      for (const id of ["listeners", "cover", "time"]) {
        expect(art.contains(screen.getByTestId(id))).toBe(true);
      }
      // The ticker is outside both panes, after them, in the centered block.
      const live = screen.getByTestId("live");
      expect(row.contains(live)).toBe(false);
      expect(row.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(row.parentElement!.contains(live)).toBe(true);
      expect(content()).toEqual({ flexGrow: 1, justifyContent: "center" });
    });

    it("sizes the scope to the info pane and the cover to the room", () => {
      setWindow(1180, 820, IPAD_INSETS);
      render(<Home />);
      const infoWidth = JSON.parse(panesOf().info.getAttribute("data-style")!).width;
      expect(Number(screen.getByTestId("scope").getAttribute("data-width"))).toBe(infoWidth);
      expect(screen.getByTestId("scope").getAttribute("data-height")).toBe(
        screen.getByTestId("logo").getAttribute("data-size"),
      );
      const cover = Number(screen.getByTestId("cover").getAttribute("data-size"));
      expect(cover).toBeGreaterThan(240);
      expect(cover).toBeLessThanOrEqual(JSON.parse(panesOf().art.getAttribute("data-style")!).width);
    });

    it("aligns the header's row with the panes", () => {
      setWindow(1180, 820, IPAD_INSETS);
      render(<Home />);
      const rowWidth = JSON.parse(panesOf().row.getAttribute("data-style")!).width;
      expect(Number(screen.getByTestId("header").getAttribute("data-row-width"))).toBe(rowWidth);
    });

    it("shows the tappable program banner only when the window is roomy", () => {
      setWindow(1180, 820, IPAD_INSETS);
      const { unmount } = render(<Home />);
      const banner = screen.getByRole("button", { name: BANNER.name });
      expect(banner.querySelector("img")?.getAttribute("src")).toBe(BANNER.imageUrl);
      // Between the logo and the program line.
      expect(
        screen.getByTestId("logo").compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        banner.compareDocumentPosition(screen.getByTestId("program")) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      unmount();

      // A landscape phone: short, no banner, a smaller logo, a bounded cover.
      setWindow(852, 393, PHONE_INSETS);
      render(<Home />);
      expect(screen.queryByRole("button", { name: BANNER.name })).toBeNull();
      expect(Number(screen.getByTestId("logo").getAttribute("data-size"))).toBeLessThan(127);
      expect(Number(screen.getByTestId("cover").getAttribute("data-size"))).toBeLessThan(240);
      cleanup();

      // A TV's body is too short for it whatever the width.
      mocks.layout = resolveLayout(960, 540, undefined, true);
      mocks.insets = { top: 0, right: 0, bottom: 0, left: 0 };
      render(<Home />);
      expect(screen.queryByRole("button", { name: BANNER.name })).toBeNull();
    });

    it("holds the banner's room until the program has an image", () => {
      mocks.player = { currentProgram: undefined };
      setWindow(1180, 820, IPAD_INSETS);
      render(<Home />);
      expect(screen.queryByRole("button", { name: BANNER.name })).toBeNull();
      const logo = screen.getByTestId("logo").parentElement!.parentElement!;
      // logo block, banner placeholder, program block, bitrate.
      expect(logo.children).toHaveLength(4);
    });
  });
});
