/**
 * Stand-in for `react-native-keyboard-controller` (a native module whose
 * source can't load under jsdom). Pair it with the react-native mock:
 *
 *   vi.mock("react-native-keyboard-controller", async () =>
 *     (await import("@/__tests__/keyboard-controller-mock")).createKeyboardControllerMock());
 *
 * The keyboard-aware scroll view renders as the mocked `ScrollView`, and the
 * imperative controller is a set of spies so tests can assert keyboard calls.
 */
import * as React from "react";
import { vi } from "vitest";

import { createReactNativeMock } from "@/__tests__/react-native-mock";

export function createKeyboardControllerMock() {
  const { ScrollView } = createReactNativeMock();
  const KeyboardAwareScrollView = React.forwardRef(
    function KeyboardAwareScrollView(
      { children, ...props }: Record<string, any>,
      ref,
    ) {
      return React.createElement(ScrollView, { ...props, ref }, children);
    },
  );
  const { View } = createReactNativeMock();
  const KeyboardStickyView = ({ children, offset: _offset, ...props }: Record<string, any>) =>
    React.createElement(View, props, children);
  return {
    KeyboardStickyView,
    KeyboardProvider: ({ children }: { children: React.ReactNode }) => children,
    KeyboardAwareScrollView,
    KeyboardController: {
      setFocusTo: vi.fn(),
      dismiss: vi.fn(() => Promise.resolve()),
      isVisible: vi.fn(() => false),
    },
  };
}
