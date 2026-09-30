// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select } from "@/components/Select";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
const { haptics } = vi.hoisted(() => ({ haptics: { select: vi.fn() } }));
vi.mock("@/utils/haptics", () => ({ haptics }));

type Key = "low" | "mid" | "high";
const OPTIONS = [
  { key: "low" as const, label: "Low", meta: "Smallest", badge: "Eco" },
  { key: "mid" as const, label: "Medium" },
  { key: "high" as const, label: "High", thumb: 1 },
];

function setup(
  props: Partial<React.ComponentProps<typeof Select<Key>>> = {},
) {
  const onChange = vi.fn<(key: Key) => void | Promise<void>>();
  render(
    <Select<Key>
      label="Quality"
      description="Cover quality"
      icon="image"
      options={OPTIONS}
      value="mid"
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

const toggleButton = () => screen.getAllByRole("button")[0];
const optionButton = (label: string) =>
  // The selected label also shows in the header; the option row comes last.
  screen.getAllByText(label).at(-1)!.closest("[role=button]") as HTMLElement;

describe("Select", () => {
  afterEach(cleanup);

  it("shows the label, description and the selected option's label collapsed", () => {
    setup();
    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("Cover quality")).toBeTruthy();
    expect(screen.getByText("Medium")).toBeTruthy();
    expect(screen.queryByText("Low")).toBeNull();
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("unfolds the options with a chevron swap and folds again", () => {
    setup();
    fireEvent.click(toggleButton());
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(document.querySelector('[data-icon="expand-less"]')).toBeTruthy();

    fireEvent.click(toggleButton());
    expect(screen.queryByText("Low")).toBeNull();
    expect(document.querySelector('[data-icon="expand-more"]')).toBeTruthy();
  });

  it("renders option meta and badge, and marks only the current value with a check", () => {
    setup();
    fireEvent.click(toggleButton());
    expect(screen.getByText("Smallest")).toBeTruthy();
    expect(screen.getByText("Eco")).toBeTruthy();
    expect(optionButton("Medium").getAttribute("aria-selected")).toBe("true");
    expect(optionButton("Low").getAttribute("aria-selected")).toBe("false");
    expect(optionButton("Medium").querySelector('[data-icon="check"]')).toBeTruthy();
    expect(optionButton("Low").querySelector('[data-icon="check"]')).toBeNull();
  });

  it("renders a thumbnail only for options that have one", () => {
    setup();
    fireEvent.click(toggleButton());
    expect(optionButton("High").querySelector("img")).toBeTruthy();
    expect(optionButton("Low").querySelector("img")).toBeNull();
  });

  it("applies a new choice, then folds the list", async () => {
    const { onChange } = setup();
    fireEvent.click(toggleButton());
    fireEvent.click(optionButton("High"));
    await waitFor(() => expect(screen.queryByText("Low")).toBeNull());
    expect(haptics.select).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("high");
  });

  it("re-choosing the current value only folds the list", async () => {
    const { onChange } = setup();
    fireEvent.click(toggleButton());
    fireEvent.click(optionButton("Medium"));
    await waitFor(() => expect(screen.queryByText("Low")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks the list behind a spinner while an async change is applying", async () => {
    let finish: () => void = () => undefined;
    const { onChange } = setup({
      onChange: vi.fn(() => new Promise<void>((res) => (finish = res))),
    });
    void onChange;
    fireEvent.click(toggleButton());
    fireEvent.click(optionButton("High"));

    // Spinner on the applying row, everything else disabled, list still open.
    expect(optionButton("High").querySelector('[role="progressbar"]')).toBeTruthy();
    expect(optionButton("High").querySelector('[data-icon="check"]')).toBeNull();
    expect(optionButton("Low").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Low")).toBeTruthy();

    await act(async () => finish());
    expect(screen.queryByText("Low")).toBeNull();
  });

  it("keeps the list open and re-enables rows when the change fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setup({ onChange: vi.fn().mockRejectedValue(new Error("disk full")) });
    fireEvent.click(toggleButton());
    fireEvent.click(optionButton("High"));
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith("[Select] change failed:", expect.any(Error)),
    );
    expect(screen.getByText("Low")).toBeTruthy();
    expect(optionButton("Low").getAttribute("aria-disabled")).toBeNull();
    expect(optionButton("High").querySelector('[role="progressbar"]')).toBeNull();
    warn.mockRestore();
  });

  it("ignores taps while another change is applying", () => {
    const onChange = vi.fn(() => new Promise<void>(() => undefined));
    setup({ onChange });
    fireEvent.click(toggleButton());
    fireEvent.click(optionButton("High"));
    fireEvent.click(optionButton("Low"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not open when disabled", () => {
    setup({ disabled: true });
    fireEvent.click(toggleButton());
    expect(screen.queryByText("Low")).toBeNull();
    expect(toggleButton().getAttribute("aria-disabled")).toBe("true");
  });
});
