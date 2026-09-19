import { DICT, type Dict } from "@/i18n";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";

/** The active language's UI dictionary (see `src/i18n`). */
export function useDict(): Dict {
  const { settings } = useUserSettings();
  return DICT[settings.selectedLanguage];
}
