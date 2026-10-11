import { KeyboardController } from "react-native-keyboard-controller";
import type { TextInput } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { dismissKeyboard, focusWithKeyboard } from "@/utils/keyboard";

vi.mock("react-native-keyboard-controller", () => ({
  KeyboardController: {
    setFocusTo: vi.fn(),
    dismiss: vi.fn(() => Promise.resolve()),
  },
}));

const field = (focused: boolean) =>
  ({ isFocused: () => focused, focus: vi.fn() }) as unknown as TextInput & {
    focus: ReturnType<typeof vi.fn>;
  };

describe("focusWithKeyboard", () => {
  it("focuses a field that is not focused yet", () => {
    const input = field(false);
    focusWithKeyboard(input);
    expect(input.focus).toHaveBeenCalledTimes(1);
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it("re-shows the keyboard for a field that is focused without one", () => {
    // RN ignores focus() on a focused field — the code-step regression: the
    // field was focused, the keyboard had been taken down by the outgoing
    // field, and nothing asked for it again.
    const input = field(true);
    focusWithKeyboard(input);
    expect(input.focus).not.toHaveBeenCalled();
    expect(KeyboardController.setFocusTo).toHaveBeenCalledWith("current");
  });

  it("ignores a field that has unmounted", () => {
    expect(() => focusWithKeyboard(null)).not.toThrow();
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });
});

describe("dismissKeyboard", () => {
  it("lowers the keyboard through the controller", () => {
    dismissKeyboard();
    expect(KeyboardController.dismiss).toHaveBeenCalledTimes(1);
  });
});
