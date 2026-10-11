import { forwardRef } from "react";
import type { ScrollViewProps } from "react-native";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THEME } from "@/theme";

interface Props extends ScrollViewProps {
  /**
   * - `"screen"` (default): a full-height page. The keyboard only extends the
   *   scrollable range (native insets, no reflow), so nothing on the page
   *   jumps — the view just scrolls the focused field into sight.
   * - `"sheet"`: a bottom sheet hugging its content. A spacer the keyboard's
   *   height joins the content, so a short sheet rides up above the keyboard
   *   and a tall one (capped by the sheet's max height) scrolls the field
   *   into sight instead.
   */
  variant?: "screen" | "sheet";
}

/**
 * The app's one keyboard-aware scroll view: every form, on every screen and
 * in every sheet, moves the same way when the keyboard opens.
 *
 * Driven by react-native-keyboard-controller, i.e. Android's
 * `WindowInsetsAnimation` IME callbacks and iOS's keyboard frame, so content
 * moves frame-by-frame WITH the keyboard instead of jumping after it.
 * It scrolls the minimum that keeps the focused field plus
 * `THEME.KEYBOARD.CLEARANCE` (room for the action under the field) visible,
 * and settles back when the keyboard hides.
 *
 * The keyboard's height on both platforms already covers the bottom safe
 * area (home indicator / Android navigation bar), which the content padding
 * also clears, so that inset is subtracted once — no stacked
 * "safe area + keyboard" gap opens above the keyboard.
 */
export const KeyboardScrollView = forwardRef<KeyboardAwareScrollViewRef, Props>(
  function KeyboardScrollView({ variant = "screen", ...props }, ref) {
    const { bottom } = useSafeAreaInsets();
    // A sheet also pads its end by SHEET_END_GAP past the safe area (see
    // Sheet); the keyboard covers that too, so it is absorbed with the inset.
    const covered =
      variant === "sheet" ? bottom + THEME.LAYOUT.SHEET_END_GAP : bottom;

    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={THEME.KEYBOARD.CLEARANCE}
        extraKeyboardSpace={-covered}
        mode={variant === "sheet" ? "layout" : "insets"}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Pages keep the platform scroll indicator like every other page;
        // a sheet's short content doesn't need one.
        showsVerticalScrollIndicator={variant !== "sheet"}
        {...props}
      />
    );
  },
);
