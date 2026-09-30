// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Animated } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CODE_LENGTH, CodeInput } from "@/components/CodeInput";

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

/** Only the caret's style carries an animated (object) opacity. */
const CARET = '[data-style*=\'"opacity":{\']';

function setup(props: Partial<React.ComponentProps<typeof CodeInput>> = {}) {
  const onChangeText = vi.fn();
  const view = render(
    <CodeInput
      value=""
      onChangeText={onChangeText}
      accessibilityLabel="Code"
      {...props}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Code" }) as HTMLInputElement;
  return { ...view, input, onChangeText };
}

describe("CodeInput", () => {
  afterEach(cleanup);

  it("paints each digit in its own box", () => {
    setup({ value: "42" });
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("ignores non-digits and anything past the code length", () => {
    const { input } = setup({ value: "1a2b3c4d5" });
    expect(input.value).toBe("1234");
    expect(CODE_LENGTH).toBe(4);
    expect(screen.queryByText("5")).toBeNull();
  });

  it("sanitizes typed or pasted text before reporting it", () => {
    const { input, onChangeText } = setup();
    fireEvent.change(input, { target: { value: "12ab3456" } });
    expect(onChangeText).toHaveBeenLastCalledWith("1234");
  });

  it("shows the caret only in the next empty box, and only while focused", () => {
    const { input, container } = setup({ value: "12" });
    expect(container.querySelectorAll(CARET)).toHaveLength(0);

    fireEvent.focus(input);
    const carets = container.querySelectorAll(CARET);
    expect(carets).toHaveLength(1);
    // It sits in the third box (index 2), after the two typed digits.
    const box = carets[0].parentElement!;
    expect(box.parentElement!.children[2]).toBe(box);

    fireEvent.blur(input);
    expect(container.querySelectorAll(CARET)).toHaveLength(0);
  });

  it("hides the caret once the code is complete", () => {
    const { input, container } = setup({ value: "1234" });
    fireEvent.focus(input);
    expect(container.querySelectorAll(CARET)).toHaveLength(0);
  });

  it("blinks the caret while focused and stops when focus leaves", () => {
    const { input } = setup();
    expect(Animated.loop).not.toHaveBeenCalled();

    fireEvent.focus(input);
    expect(Animated.loop).toHaveBeenCalledTimes(1);
    const loop = vi.mocked(Animated.loop).mock.results[0].value;
    expect(loop.start).toHaveBeenCalledTimes(1);
    expect(loop.stop).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(loop.stop).toHaveBeenCalledTimes(1);
  });

  it("does not blink while not editable", () => {
    const { input } = setup({ editable: false });
    expect(input.disabled).toBe(true);
    fireEvent.focus(input);
    expect(Animated.loop).not.toHaveBeenCalled();
  });

  it("pulls focus back to the field when editing resumes after a verify", () => {
    const { input, rerender, onChangeText } = setup({ editable: false });
    expect(document.activeElement).not.toBe(input);
    rerender(
      <CodeInput
        value=""
        onChangeText={onChangeText}
        editable
        accessibilityLabel="Code"
      />,
    );
    expect(document.activeElement).toBe(input);
  });

  it("does not steal focus when it was editable all along", () => {
    const { input, rerender, onChangeText } = setup();
    rerender(
      <CodeInput
        value="1"
        onChangeText={onChangeText}
        accessibilityLabel="Code"
      />,
    );
    expect(document.activeElement).not.toBe(input);
  });

  it("re-renders boxes when the value prop changes", () => {
    const { rerender, onChangeText } = setup({ value: "9" });
    expect(screen.getByText("9")).toBeTruthy();
    act(() => {
      rerender(<CodeInput value="" onChangeText={onChangeText} accessibilityLabel="Code" />);
    });
    expect(screen.queryByText("9")).toBeNull();
  });
});
