/**
 * Animu Connect code rules, mirrored from the server (`EMAIL_CODE_*` in
 * animu-api's API.md). The server ignores resends inside its cooldown without
 * telling us, so the client lockout must not be shorter than the server's or
 * the countdown promises a resend that never arrives.
 */

/** Resend lockout (seconds) after an Animu Connect code is sent. */
export const RESEND_COOLDOWN_SECONDS = 60;
/** How long an emailed code stays valid. */
export const CODE_TTL_MINUTES = 10;
/** Wrong guesses the server accepts before the code is burned. */
export const CODE_MAX_ATTEMPTS = 5;
