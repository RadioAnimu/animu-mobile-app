// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrimaryButton } from "@/components/PrimaryButton";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);

afterEach(cleanup);

describe("PrimaryButton", () => {
  it("fires onPress", () => {
    const onPress = vi.fn();
    render(<PrimaryButton label="Send code" onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks presses while disabled", () => {
    const onPress = vi.fn();
    render(<PrimaryButton label="Send code" onPress={onPress} disabled />);
    const button = screen.getByRole("button", { name: "Send code" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows a spinner and blocks presses while loading", () => {
    const onPress = vi.fn();
    render(<PrimaryButton label="Send code" onPress={onPress} loading />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
