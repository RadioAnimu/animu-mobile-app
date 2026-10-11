import type { TextInput } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

/**
 * Focuses a field AND guarantees the keyboard is up for it.
 *
 * `TextInput.focus()` alone is not enough: React Native ignores it for a
 * field it already considers focused, yet that field can be focused with no
 * keyboard — a step swap (email → code) focuses the new field while the old
 * one's blur is still taking the keyboard down, and the show request loses
 * that race. Re-asking the platform to show the IME for the current field
 * (`setFocusTo("current")` → Android `requestFocusFromJS` / iOS
 * `becomeFirstResponder`) closes the gap; on a field whose keyboard is
 * already up it's a no-op.
 */
export function focusWithKeyboard(input: TextInput | null): void {
  if (!input) return;
  if (!input.isFocused()) {
    input.focus();
    return;
  }
  // Not gated on `isVisible()`: mid-hide it still reads true, which is
  // exactly the race this exists for. Re-showing an open keyboard is a no-op.
  KeyboardController.setFocusTo("current");
}

/** Lowers the keyboard (and blurs the field) — the one dismissal path. */
export function dismissKeyboard(): void {
  void KeyboardController.dismiss();
}
