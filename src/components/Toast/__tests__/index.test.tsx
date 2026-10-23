// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toast } from "@/components/Toast";
import { THEME } from "@/theme";

/** `Animated.sequence` steps are recorded so holds can be asserted from them. */
const animated = vi.hoisted(() => {
  const timing = vi.fn(() => ({ stop: vi.fn() }));
  const delay = vi.fn(() => ({ stop: vi.fn() }));
  const sequence = vi.fn(() => ({ start: vi.fn(), stop: vi.fn() }));
  class Value {
    value = 0;
    setValue(next: number) {
      this.value = next;
    }
    interpolate() {
      return {};
    }
  }
  return { timing, delay, sequence, Value };
});

vi.mock("react-native", () => {
  const flattenStyle = (style: unknown): Record<string, unknown> =>
    Array.isArray(style)
      ? style.reduce<Record<string, unknown>>(
          (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
          {},
        )
      : style && typeof style === "object"
        ? (style as Record<string, unknown>)
        : {};

  const passthrough = (tag: string) => {
    const Component = ({
      children,
      onPress,
      accessibilityLabel,
      pointerEvents,
      style,
    }: Record<string, unknown>) =>
      React.createElement(
        tag,
        {
          "aria-label": accessibilityLabel as string | undefined,
          "data-pointer-events": pointerEvents as string | undefined,
          "data-style": JSON.stringify(flattenStyle(style)),
          onClick: onPress as (() => void) | undefined,
        },
        children as React.ReactNode,
      );
    Component.displayName = `Mock(${tag})`;
    return Component;
  };
  return {
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: "ios", isTV: false, select: (spec: Record<string, unknown>) => spec.ios ?? spec.default },
    Easing: {
      out: (fn: unknown) => fn,
      in: (fn: unknown) => fn,
      inOut: (fn: unknown) => fn,
    },
    StyleSheet: { create: (styles: object) => styles },
    Animated: {
      View: passthrough("div"),
      Value: animated.Value,
      timing: animated.timing,
      delay: animated.delay,
      sequence: animated.sequence,
    },
    Text: passthrough("span"),
    TouchableOpacity: passthrough("button"),
  };
});

vi.mock("@/components/Icon", () => ({
  Icon: ({ name }: { name: string }) => <i data-icon={name} />,
}));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
const haptics = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/utils/haptics", () => ({ haptics }));

// Mutable stand-ins for the window the chip is measured against.
const windowCtl = vi.hoisted(() => ({ width: 393 }));
vi.mock("@/hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({ width: windowCtl.width, height: 852 }),
}));
const insetsCtl = vi.hoisted(() => ({ value: { left: 0, right: 0 } }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => insetsCtl.value,
}));

afterEach(cleanup);

describe("Toast", () => {
  beforeEach(() => {
    windowCtl.width = 393;
    insetsCtl.value = { left: 0, right: 0 };
  });

  it("renders an action-less chip as a non-interactive surface", () => {
    const { container } = render(<Toast message="Copied" />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.getAttribute("data-pointer-events")).toBe("none");
    expect(screen.queryByRole("button")).toBeNull();
    // Variant holds stay untouched.
    expect(animated.delay).toHaveBeenLastCalledWith(1800);
  });

  it("renders an action toast as an interactive chip with a trailing button", () => {
    const { container } = render(
      <Toast message="History cleared" action={{ label: "Undo", onPress: vi.fn() }} />,
    );

    const chip = container.firstChild as HTMLElement;
    expect(chip.getAttribute("data-pointer-events")).toBe("auto");
    expect(screen.getByText("History cleared")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("holds an action toast for 5s, regardless of the variant", () => {
    render(
      <Toast
        message="History cleared"
        variant="error"
        action={{ label: "Undo", onPress: vi.fn() }}
      />,
    );

    // The error variant alone holds 4000ms; the action's 5s wins.
    expect(animated.delay).toHaveBeenCalledWith(5000);
  });

  it("fires the action exactly once — even on a double tap — and dismisses", () => {
    const onPress = vi.fn();
    const onDone = vi.fn();
    render(
      <Toast message="History cleared" action={{ label: "Undo", onPress }} onDone={onDone} />,
    );

    const button = screen.getByRole("button", { name: "Undo" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(haptics.select).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("still dismisses on its own when the fade completes", () => {
    const onDone = vi.fn();
    render(
      <Toast message="Copied" action={{ label: "Undo", onPress: vi.fn() }} onDone={onDone} />,
    );

    // The mocked sequence holds the start callback; finishing it must dismiss.
    const start = animated.sequence.mock.results.at(-1)?.value.start;
    act(() => start?.mock.calls[0]?.[0]?.({ finished: true }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("keeps the phone-era 86% width on a phone in portrait", () => {
    const { container } = render(<Toast message="Copied" />);
    const style = JSON.parse(
      (container.firstChild as HTMLElement).dataset.style ?? "{}",
    );
    expect(style.maxWidth).toBeCloseTo(393 * 0.86);
    expect(style.marginLeft).toBe(0);
  });

  it("caps the chip width once the window outgrows a phone", () => {
    windowCtl.width = 1180;
    const { container } = render(<Toast message="Copied" />);
    const style = JSON.parse(
      (container.firstChild as HTMLElement).dataset.style ?? "{}",
    );
    expect(style.maxWidth).toBe(THEME.LAYOUT.CONTENT_MAX_WIDTH);
  });

  it("stays clear of the side insets in landscape", () => {
    windowCtl.width = 852;
    insetsCtl.value = { left: 47, right: 0 };
    const { container } = render(<Toast message="Copied" />);
    const style = JSON.parse(
      (container.firstChild as HTMLElement).dataset.style ?? "{}",
    );
    expect(style.maxWidth).toBe(THEME.LAYOUT.CONTENT_MAX_WIDTH - 47);
    expect(style.marginLeft).toBe(47);
    expect(style.marginRight).toBe(0);
  });
});
