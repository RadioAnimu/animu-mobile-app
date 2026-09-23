/**
 * UI language keys and their labels — the single source of truth for the
 * `DICT`/`IMGS` maps in `@/i18n` and for runtime validation of the persisted
 * `selectedLanguage`. Kept dependency-free (no JSX/assets) so non-UI modules
 * can import it without pulling the whole i18n module graph.
 */
export const LANGUAGE_LABELS = {
  PT: "Português",
  EN: "English",
  ES: "Español",
  JN: "日本語",
} as const;
