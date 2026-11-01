// @vitest-environment jsdom
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "@/components/Sheet";
import { THEME } from "@/theme";
import type { ResponsiveLayout } from "@/theme/layout";

vi.mock("react-native", async () => {
  const base = (
    await import("@/__tests__/react-native-mock")
  ).createReactNativeMock();
  // The mock has no Modal: the sheet renders through it whenever mounted.
  return {
    ...base,
    Modal: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) => (visible ? <div>{children}</div> : null),
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => insetsCtl.value,
}));
vi.mock("expo-image", () => ({ Image: () => <img alt="" /> }));
vi.mock("@/components/Toast", () => ({ Toast: () => null }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ A11Y_CLOSE: "Close" }),
}));
// The enter/exit is timing-only; here the modal mounts while `visible`.
vi.mock("@/hooks/usePresence", () => ({
  usePresence: (visible: boolean) => ({
    mounted: visible,
    progress: { interpolate: () => 0 },
  }),
}));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
vi.mock("@/hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => layout.value,
}));

const insetsCtl = vi.hoisted(() => ({
  value: { top: 0, bottom: 0, left: 0, right: 0 },
}));

const layout = vi.hoisted(() => ({
  value: {
    width: 393,
    height: 852,
    windowClass: "compact",
    landscape: false,
    split: false,
    short: false,
    windowControlsInset: 0,
  },
}));

const setLayout = (width: number, height: number) => {
  layout.value = {
    width,
    height,
    windowClass: width >= 840 ? "expanded" : width >= 600 ? "medium" : "compact",
    landscape: width > height,
    split: width >= 560 && width > height * 1.2,
    short: height < 500,
    windowControlsInset: 0,
  } as ResponsiveLayout;
};

/** The sheet surface is the one view that carries the sheet's corner radius. */
const sheetStyle = (): Record<string, unknown> => {
  const el = [...document.querySelectorAll<HTMLElement>("[data-style]")].find(
    (candidate) =>
      "borderTopLeftRadius" in JSON.parse(candidate.dataset.style ?? "{}"),
  );
  if (!el) throw new Error("no sheet element rendered");
  return JSON.parse(el.dataset.style ?? "{}");
};

/** The content column: the one view that pads past the notch insets. */
const contentStyle = (): Record<string, unknown> => {
  const el = [...document.querySelectorAll<HTMLElement>("[data-style]")].find((candidate) => {
    const style = JSON.parse(candidate.dataset.style ?? "{}");
    return "paddingLeft" in style && "maxWidth" in style;
  });
  if (!el) throw new Error("no sheet content rendered");
  return JSON.parse(el.dataset.style ?? "{}");
};

describe("Sheet", () => {
  beforeEach(() => {
    layout.value = {
      width: 393,
      height: 852,
      windowClass: "compact",
      landscape: false,
      split: false,
      short: false,
      windowControlsInset: 0,
    } as ResponsiveLayout;
    insetsCtl.value = { top: 0, bottom: 0, left: 0, right: 0 };
  });
  afterEach(cleanup);

  it("spans the window edge to edge, as in portrait, at every size", () => {
    for (const [width, height] of [[393, 852], [852, 393], [1180, 820]] as const) {
      setLayout(width, height);
      render(
        <Sheet visible onClose={vi.fn()}>
          content
        </Sheet>,
      );
      const sheet = sheetStyle();
      expect(sheet.maxWidth).toBeUndefined();
      expect(sheet.marginLeft).toBeUndefined();
      expect(sheet.marginRight).toBeUndefined();
      cleanup();
    }
  });

  it("holds its content in a readable centered column on a wide window", () => {
    setLayout(1180, 820);
    render(
      <Sheet visible onClose={vi.fn()}>
        content
      </Sheet>,
    );
    const column = contentStyle();
    expect(column.maxWidth).toBe(THEME.LAYOUT.CONTENT_MAX_WIDTH);
    expect(column.alignSelf).toBe("center");
  });

  it("keeps the content clear of the notch insets, on top of the column's cap", () => {
    setLayout(852, 393);
    insetsCtl.value = { top: 0, bottom: 21, left: 47, right: 0 };
    render(
      <Sheet visible onClose={vi.fn()}>
        content
      </Sheet>,
    );
    const column = contentStyle();
    expect(column.paddingLeft).toBe(47);
    expect(column.paddingRight).toBe(0);
    expect(column.maxWidth).toBe(THEME.LAYOUT.CONTENT_MAX_WIDTH + 47);
  });

  it("caps the height in a short window so the content scrolls instead of clipping", () => {
    setLayout(852, 393);
    insetsCtl.value = { top: 0, bottom: 21, left: 0, right: 0 };
    render(
      <Sheet visible onClose={vi.fn()} maxHeight="75%">
        content
      </Sheet>,
    );
    // The window cap wins over the caller's percentage, and leaves one gap
    // under the window top.
    expect(sheetStyle().maxHeight).toBe(393 - insetsCtl.value.top - THEME.SPACE.MD);
  });

  it("does not add a window height cap outside short windows", () => {
    render(
      <Sheet visible onClose={vi.fn()} maxHeight="75%">
        content
      </Sheet>,
    );
    expect(sheetStyle().maxHeight).toBe("75%");
  });
});
