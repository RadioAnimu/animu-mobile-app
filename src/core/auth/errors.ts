/** Thrown when the user dismisses an OAuth prompt — not a real failure. */
export class AuthFlowCancelled extends Error {
  constructor() {
    super("Authentication cancelled");
    this.name = "AuthFlowCancelled";
  }
}

/**
 * Thrown when a FIRST sign-in with a provider is refused because the
 * provider's email already belongs to ANOTHER Animu account. The user has to
 * sign in the way they did before and link the provider from Account — a
 * retry can never succeed, so this is told apart from a generic failure.
 */
export class ProviderEmailTaken extends Error {
  /** Provider id (e.g. `"google"`); unknown when resuming a cold-start bounce. */
  readonly provider?: string;

  constructor(provider?: string) {
    super("Provider email already belongs to another account");
    this.name = "ProviderEmailTaken";
    this.provider = provider;
  }
}

/**
 * Thrown when linking a provider is refused because that provider identity
 * already belongs to ANOTHER Animu account. Only that account's owner can
 * free it, so a retry can never succeed — told apart from a generic failure.
 */
export class ProviderLinkConflict extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super("Provider account is already linked to another account");
    this.name = "ProviderLinkConflict";
    this.provider = provider;
  }
}
