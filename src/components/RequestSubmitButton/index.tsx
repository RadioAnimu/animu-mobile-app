import { SheetButton } from "@/components/SheetButton";
import { useDict } from "@/hooks/useDict";

interface Props {
  submitting: boolean;
  /** The last attempt failed — the button turns into "Try again". */
  failed: boolean;
  onPress: () => void;
}

/** The send button both request sheets share: Send, spinner, then Try again. */
export function RequestSubmitButton({ submitting, failed, onPress }: Readonly<Props>) {
  const dict = useDict();

  return (
    <SheetButton
      label={failed ? dict.ERROR_RETRY : dict.SEND_REQUEST_BUTTON_TEXT}
      icon={failed ? "refresh" : "send"}
      loading={submitting}
      onPress={onPress}
    />
  );
}
