/** Context about the request that produced an error. */
export interface RequestInfo {
  method?: string;
  url?: string;
}

/**
 * Error thrown for any failed HTTP exchange or boundary validation failure.
 *
 * Carries the HTTP status when known (0 for network/timeout/validation
 * failures) plus the request method and URL for debugging.
 */
export class AnimuApiError extends Error {
  /** HTTP status code, or `0` when the request never got a response. */
  readonly statusCode: number;
  /** Request URL, when known. */
  readonly url?: string;
  /** Request method, when known. */
  readonly method?: string;

  constructor(
    message: string,
    statusCode = 0,
    info: RequestInfo = {},
  ) {
    super(message);
    this.name = "AnimuApiError";
    this.statusCode = statusCode;
    this.url = info.url;
    this.method = info.method;
    Object.setPrototypeOf(this, AnimuApiError.prototype);
  }

  /** Status/method/url as a plain object for logging. */
  get details() {
    return {
      status: this.statusCode,
      url: this.url,
      method: this.method,
    };
  }
}

/**
 * Thrown when a response payload fails schema validation, or when input
 * passed to a client method is rejected before any network call is made.
 */
export class ValidationError extends AnimuApiError {
  constructor(message: string, url: string) {
    super(message, 0, { method: "GET", url });
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Structured result of a music-request submission. The submission endpoint
 * reports business errors (rate limits, blocks, session problems) in the
 * response body rather than via HTTP status, so these are returned as data
 * instead of thrown.
 */
export type RequestResult =
  | { success: true }
  | { success: false; error: RequestErrorCode | string; detail?: string };

/**
 * Known machine-readable error codes returned by the submission endpoint.
 * Unknown payloads fall back to `"REQUEST_ERROR"` or the raw server text.
 */
export type RequestErrorCode =
  | "PANEL_UNAVAILABLE"
  | "PEDIBLOCK"
  | "ANIBLOCK"
  | "ARTISTBLOCK"
  | "COVERBLOCK"
  | "HARUBLOCK"
  | "STRIKE_AND_OUT"
  | "ONAIR"
  | "BLOCOBLOCK"
  | "NOLOGIN"
  | "NO2FA"
  | "REQUEST_ERROR";

/**
 * Maps a submission error code to a human-readable English message.
 * Display whatever suits your project — this is a convenience, not i18n.
 *
 * @param error - Code from a failed {@link RequestResult}, if any.
 * @param detail - Server-provided detail (e.g. unblock datetime for PEDIBLOCK).
 * @returns A user-presentable English sentence.
 */
export function requestResultMessage(
  error?: string,
  detail?: string,
): string {
  switch (error) {
    case "PEDIBLOCK":
      return detail
        ? `This track was already requested. Available again after ${new Date(detail + "Z").toLocaleTimeString()}`
        : "This track was requested too recently.";
    case "ANIBLOCK":
      return `Too many songs from "${detail}" in the last 90 minutes.`;
    case "ARTISTBLOCK":
      return `Too many songs from "${detail}" in the last 90 minutes.`;
    case "HARUBLOCK":
      return "This track was played too recently by the AutoDJ.";
    case "STRIKE_AND_OUT":
      return "You've reached the request limit.";
    case "ONAIR":
      return "Requests are disabled while a DJ is live.";
    case "BLOCOBLOCK":
      return "Requests are currently disabled.";
    case "NOLOGIN":
      return "Your session expired. Please log in again.";
    case "NO2FA":
      return "You need 2FA enabled on Discord to make requests.";
    case "PANEL_UNAVAILABLE":
      return "The radio panel is temporarily unavailable. Try again in a moment.";
    default:
      return "Something went wrong with your request. Try again.";
  }
}
