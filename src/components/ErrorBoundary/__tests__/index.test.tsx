// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "@/components/ErrorBoundary";

vi.mock("react-native", async () => {
  const React = await import("react");
  const base = (await import("@/__tests__/react-native-mock")).createReactNativeMock();
  return {
    ...base,
    // A real <button> so the retry control has the button role and a name.
    TouchableOpacity: ({ children, onPress }: Record<string, unknown>) =>
      React.createElement(
        "button",
        { onClick: onPress as () => void },
        children as React.ReactNode,
      ),
  };
});

vi.mock("@/i18n", () => ({
  FALLBACK_LANGUAGE: "PT",
  DICT: {
    PT: {
      ERROR_TITLE: "Something broke",
      ERROR_MESSAGE: "Please try again",
      ERROR_RETRY: "Retry",
    },
  },
}));

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error("boom");
  return <span>healthy child</span>;
}

describe("ErrorBoundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; keep the test output clean and let us
    // assert the boundary's own report.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    errorSpy.mockRestore();
  });

  it("renders children untouched when nothing throws", () => {
    shouldThrow = false;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("healthy child")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the fallback screen and logs when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something broke")).toBeTruthy();
    expect(screen.getByText("Please try again")).toBeTruthy();
    expect(screen.queryByText("healthy child")).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "[ErrorBoundary]",
      expect.objectContaining({ message: "boom" }),
      expect.any(String),
    );
  });

  it("retry re-renders the children once the cause is gone", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("healthy child")).toBeTruthy();
    expect(screen.queryByText("Something broke")).toBeNull();
  });

  it("falls back again when the retried child still throws", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Something broke")).toBeTruthy();
  });
});
