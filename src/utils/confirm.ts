import { Alert } from "react-native";

export interface DestructiveConfirm {
  title: string;
  message: string;
  cancel: string;
  /** The destructive button's label. */
  confirm: string;
  onConfirm: () => void;
}

/** Asks before a destructive action: the system alert, Cancel first. */
export function confirmDestructive({ title, message, cancel, confirm, onConfirm }: DestructiveConfirm): void {
  Alert.alert(title, message, [
    { text: cancel, style: "cancel" },
    { text: confirm, style: "destructive", onPress: onConfirm },
  ]);
}
