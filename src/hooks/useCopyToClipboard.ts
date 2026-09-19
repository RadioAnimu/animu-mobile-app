import { useCallback } from "react";
import * as Clipboard from "expo-clipboard";

import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";

/** Copies text to the clipboard and flashes the standard "copied" toast. */
export function useCopyToClipboard() {
  const { toast } = useAlert();
  const dict = useDict();

  return useCallback(
    (text: string) => {
      haptics.select();
      void Clipboard.setStringAsync(text);
      toast(dict.TEXT_COPIED);
    },
    [toast, dict],
  );
}
