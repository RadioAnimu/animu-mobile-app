import { DICT as DICT_EN, IMGS as IMGS_EN } from "@/i18n/language.en";
import { DICT as DICT_ES, IMGS as IMGS_ES } from "@/i18n/language.es";
import { DICT as DICT_JP, IMGS as IMGS_JP } from "@/i18n/language.jn";
import { DICT as DICT_PT, IMGS as IMGS_PT } from "@/i18n/language.pt";

export const DICT = {
  PT: DICT_PT,
  EN: DICT_EN,
  ES: DICT_ES,
  JN: DICT_JP,
};

export const IMGS = {
  PT: IMGS_PT,
  EN: IMGS_EN,
  ES: IMGS_ES,
  JN: IMGS_JP,
};

export const LANGS_KEY_VALUE_PAIRS = {
  PT: "Português",
  EN: "English",
  ES: "Español",
  JN: "日本語",
};

export type LanguageKey = keyof typeof DICT;

export type { Dict } from "@/i18n/language.en";

export const selectedLanguage: keyof typeof DICT = "EN";
