import { useCallback } from "react";
import * as Clipboard from "expo-clipboard";

import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";

/**
 * Copies text to the clipboard; "copied" (or `copiedMessage`) only once the
 * clipboard took it — a browser can refuse.
 */
export function useCopyToClipboard() {
  const { toast } = useAlert();
  const dict = useDict();

  return useCallback(
    (text: string, copiedMessage: string = dict.TEXT_COPIED) => {
      haptics.select();
      Clipboard.setStringAsync(text)
        .then((copied) => {
          if (copied === false) throw new Error("clipboard refused the text");
          toast(copiedMessage);
        })
        .catch((error: unknown) => {
          console.warn("[Clipboard] copy failed:", error);
          toast(dict.TEXT_COPY_FAILED, "error");
        });
    },
    [toast, dict],
  );
}
