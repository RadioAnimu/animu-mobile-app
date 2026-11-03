import type { DestructiveConfirm } from "@/utils/confirm";

/** Web build: react-native-web's `Alert` is a no-op, so the browser's own dialog asks. */
export function confirmDestructive({ title, message, onConfirm }: DestructiveConfirm): void {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
