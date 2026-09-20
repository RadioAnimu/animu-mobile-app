import { DICT, type Dict } from "@/i18n";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";

/** The active language's UI dictionary (see `src/i18n`). */
export function useDict(): Dict {
  const { settings } = useUserSettings();
  // Defence in depth against a stale/corrupt persisted language: the settings
  // service sanitizes on load, but a bad value here would otherwise return
  // `undefined` and crash every consumer of the dictionary.
  const dict: Dict | undefined = DICT[settings.selectedLanguage];
  return dict ?? DICT.PT;
}
