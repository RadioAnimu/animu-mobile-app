/** Thrown when the user dismisses an OAuth prompt — not a real failure. */
export class AuthFlowCancelled extends Error {
  constructor() {
    super("Authentication cancelled");
    this.name = "AuthFlowCancelled";
  }
}
