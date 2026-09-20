/**
 * Server-vs-device clock offset from an HTTP `date` header.
 *
 * The `date` header is the server's wall clock at response time; the true
 * offset is that instant minus the device's clock at the *midpoint* of the
 * round-trip. One-second header resolution means the result is only good to
 * ~1s — callers must ignore small values and act only on gross skew.
 *
 * Pure and dependency-free so the transport wrapper stays trivial and this
 * stays unit-testable without native modules.
 */
export const serverSkewFromDate = (
  serverDate: string | null,
  sentAtMs: number,
  receivedAtMs: number,
): number | null => {
  if (!serverDate) return null;
  const serverMs = Date.parse(serverDate);
  if (!Number.isFinite(serverMs)) return null;
  return serverMs - (sentAtMs + receivedAtMs) / 2;
};
