/** Keep diagnostics useful without recording response bodies, URLs or tokens. */
export function safeErrorDetails(error: unknown): {
  type: string;
  status?: number;
} {
  const type = error instanceof Error && error.name === "AbortError"
    ? "AbortError"
    : "Error";
  const status = error && typeof error === "object" && "status" in error
    ? error.status
    : undefined;
  if (typeof status !== "number") return { type };
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? { type, status }
    : { type };
}
