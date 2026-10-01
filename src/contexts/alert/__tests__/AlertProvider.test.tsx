// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlertProvider, useAlert } from "@/contexts/alert/AlertProvider";

vi.mock("react-native", () => {
  const passthrough = (tag: string) => {
    const Component = ({
      children,
      onPress,
      accessibilityLabel,
    }: Record<string, unknown>) =>
      React.createElement(
        tag,
        {
          "aria-label": accessibilityLabel as string | undefined,
          onClick: onPress as (() => void) | undefined,
        },
        children as React.ReactNode,
      );
    Component.displayName = `Mock(${tag})`;
    return Component;
  };
  return {
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    StyleSheet: { create: (styles: object) => styles },
    // Like the real Modal: nothing is mounted while not visible.
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? React.createElement("div", { role: "dialog" }, children) : null,
    KeyboardAvoidingView: passthrough("div"),
    View: passthrough("div"),
    Text: passthrough("span"),
    TouchableOpacity: passthrough("button"),
  };
});

vi.mock("expo-image", () => ({
  Image: ({ source }: { source: unknown }) =>
    React.createElement("img", { "data-source": String(source), alt: "" }),
}));

vi.mock("@/assets/success_haruka.webp", () => ({ default: "success-art" }));
vi.mock("@/assets/error_haruka.webp", () => ({ default: "error-art" }));
vi.mock("@react-native-vector-icons/material-icons/static", () => ({
  default: () => null,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 10, left: 0, right: 0 }),
}));
vi.mock("@/contexts/Portal", () => ({
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/Toast", () => ({
  Toast: ({ message, variant }: { message: string; variant?: string }) => (
    <p data-testid="toast" data-variant={variant}>
      {message}
    </p>
  ),
}));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ OK_BUTTON: "OK", A11Y_CLOSE: "Close" }),
}));

const Trigger = () => {
  const alert = useAlert();
  return (
    <>
      <button onClick={() => alert.success("Saved!")}>success</button>
      <button onClick={() => alert.error("Boom")}>error</button>
      <button onClick={() => alert.toast("Copied")}>toast</button>
      <button onClick={() => alert.toast("Nope", "error")}>toast-error</button>
    </>
  );
};

const renderProvider = () =>
  render(
    <AlertProvider>
      <Trigger />
    </AlertProvider>,
  );

describe("useAlert outside a provider", () => {
  it("returns inert functions instead of throwing", () => {
    const { result } = renderHook(() => useAlert());

    expect(() => {
      result.current.success("x");
      result.current.error("y");
      result.current.toast("z");
    }).not.toThrow();
  });
});

describe("AlertProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows nothing until an alert is raised", () => {
    renderProvider();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a success alert with the success art and message", () => {
    renderProvider();
    fireEvent.click(screen.getByText("success"));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Saved!")).toBeTruthy();
    expect(document.querySelector("img")?.getAttribute("data-source")).toBe(
      "success-art",
    );
  });

  it("shows an error alert with the error art", () => {
    renderProvider();
    fireEvent.click(screen.getByText("error"));

    expect(screen.getByText("Boom")).toBeTruthy();
    expect(document.querySelector("img")?.getAttribute("data-source")).toBe(
      "error-art",
    );
  });

  it("auto-dismisses after 3 seconds", () => {
    renderProvider();
    fireEvent.click(screen.getByText("success"));

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a second alert replaces the first and is not cut short by the first's timer", () => {
    renderProvider();
    fireEvent.click(screen.getByText("success"));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    fireEvent.click(screen.getByText("error"));

    expect(screen.queryByText("Saved!")).toBeNull();
    expect(screen.getByText("Boom")).toBeTruthy();

    // The first timer would have fired at 3s (1s from now); the second must
    // live a full 3s from ITS start.
    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(screen.getByText("Boom")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes from the OK and close buttons", () => {
    renderProvider();
    fireEvent.click(screen.getByText("success"));
    fireEvent.click(screen.getByText("OK"));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByText("error"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a toast without opening the modal", () => {
    renderProvider();
    fireEvent.click(screen.getByText("toast"));

    expect(screen.getByTestId("toast").textContent).toBe("Copied");
    expect(screen.getByTestId("toast").getAttribute("data-variant")).toBe(
      "success",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders an error chip, not the modal, for toast errors", () => {
    renderProvider();
    fireEvent.click(screen.getByText("toast-error"));

    expect(screen.getByTestId("toast").getAttribute("data-variant")).toBe(
      "error",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
