import type { Dict } from "@/i18n";
import { interpolate } from "@/utils/format";

type SubmissionErrorDict = Pick<
  Dict,
  | "REQUEST_ERROR_PEDIBLOCK"
  | "REQUEST_ERROR_PEDIBLOCK_RECENT"
  | "REQUEST_ERROR_BLOCK_90"
  | "REQUEST_ERROR_HARUBLOCK"
  | "ERROR_STRIKE_AND_OUT"
  | "REQUEST_ERROR_ONAIR"
  | "REQUEST_ERROR_BLOCOBLOCK"
  | "REQUEST_ERROR_NOLOGIN"
  | "REQUEST_ERROR_NO2FA"
  | "REQUEST_ERROR_PANEL"
  | "REQUEST_ERROR"
>;

/**
 * Maps a submission result to a user-facing message (the package and the
 * request service stay language-agnostic).
 */
export const getSubmissionErrorMessage = (
  t: SubmissionErrorDict,
  error?: string,
  detail?: string,
): string => {
  const withDetail = (template: string) =>
    interpolate(template, { detail: detail ?? "" });

  // Server sends raw lowercase spellings (`erro: "harublock"`); the package
  // normalizes known blocks to uppercased codes — match both.
  switch ((error ?? "").toUpperCase()) {
    case "PEDIBLOCK":
      return detail
        ? interpolate(t.REQUEST_ERROR_PEDIBLOCK, {
            time: new Date(detail + "Z").toLocaleTimeString(),
          })
        : t.REQUEST_ERROR_PEDIBLOCK_RECENT;
    case "ANIBLOCK":
    case "ARTISTBLOCK":
      return withDetail(t.REQUEST_ERROR_BLOCK_90);
    case "HARUBLOCK":
      return t.REQUEST_ERROR_HARUBLOCK;
    case "STRIKE AND OUT":
    case "STRIKE_AND_OUT":
      return t.ERROR_STRIKE_AND_OUT;
    case "ONAIR":
      return t.REQUEST_ERROR_ONAIR;
    case "BLOCOBLOCK":
      return t.REQUEST_ERROR_BLOCOBLOCK;
    case "NOLOGIN":
      return t.REQUEST_ERROR_NOLOGIN;
    case "NO2FA":
      return t.REQUEST_ERROR_NO2FA;
    case "PANEL_UNAVAILABLE":
      return t.REQUEST_ERROR_PANEL;
    default:
      return t.REQUEST_ERROR;
  }
};
