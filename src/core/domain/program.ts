import type { Program as AnimuProgram } from "animu-api";

/**
 * The package's mapped program, enriched with the index of the matching i18n
 * PROGRAMS entry (app-side concern — the package doesn't know about DICT).
 * The per-language PROGRAMS tables are index-aligned, so consumers resolve
 * the localized entry for the active language with `dict.PROGRAMS[index]`.
 */
export type Program = AnimuProgram & {
  programIndex?: number;
};
