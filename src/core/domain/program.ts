import type { Program as AnimuProgram } from "animu-api";
import { Program as ProgramDictionaryEntry } from "../../api";

/**
 * The package's mapped program, enriched with the matching i18n dictionary
 * entry (app-side concern — the package doesn't know about DICT).
 */
export type Program = AnimuProgram & {
  raw?: ProgramDictionaryEntry;
};
