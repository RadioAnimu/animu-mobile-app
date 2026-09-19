/**
 * Result of submitting a music or live request.
 *
 * `error` is a stable, machine-readable code the UI maps to a localized
 * message; `detail` carries extra context (a server detail or a validation
 * message) when one is available. Network failures normalize to
 * `"REQUEST_ERROR"`.
 */
export interface RequestSubmitResult {
  success: boolean;
  error?: string;
  detail?: string;
}
