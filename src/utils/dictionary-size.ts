import { DICTIONARY_BYTES, DICTIONARY_STORED_BYTES } from "@/core/japanese";
import type { Dict } from "@/i18n";
import { formatBytes } from "@/utils/format";

/** "17 MB download, 62 MB on device" in the user's language. */
export function dictionarySize(dict: Dict): string {
  return dict.SETTINGS_JP_DICTIONARY_SIZE.replace("{download}", formatBytes(DICTIONARY_BYTES, dict.NUMBER_DECIMAL_SEPARATOR)).replace(
    "{stored}",
    formatBytes(DICTIONARY_STORED_BYTES, dict.NUMBER_DECIMAL_SEPARATOR),
  );
}

/** "62 MB on device" — what an installed dictionary occupies. */
export function dictionaryStoredSize(dict: Dict): string {
  return dict.SETTINGS_JP_DICTIONARY_ON_DEVICE.replace(
    "{stored}",
    formatBytes(DICTIONARY_STORED_BYTES, dict.NUMBER_DECIMAL_SEPARATOR),
  );
}
