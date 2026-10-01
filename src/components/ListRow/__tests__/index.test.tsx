// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionRow } from "@/components/ListRow";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);

afterEach(cleanup);

describe("ActionRow", () => {
  it("renders the label and description and fires onPress", () => {
    const onPress = vi.fn();
    render(
      <ActionRow
        label="Log out"
        description="Sign out on this device"
        icon="logout"
        onPress={onPress}
      />,
    );
    expect(screen.getByText("Sign out on this device")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner and ignores presses while busy", () => {
    const onPress = vi.fn();
    render(<ActionRow label="Log out" icon="logout" onPress={onPress} busy />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
