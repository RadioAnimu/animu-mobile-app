/**
 * Apple's "Hide My Email" relay domain. A Sign in with Apple account can carry
 * a `…@privaterelay.appleid.com` address; the server links it like any other
 * email, but Apple only forwards mail it has been asked to relay and never
 * hands one of our sign-in codes over, so the row has to say the code can't
 * arrive instead of letting the user sit and wait for one.
 */
const APPLE_RELAY_DOMAIN = "privaterelay.appleid.com";

/** True when the address is an Apple Hide My Email relay (domain, any case). */
export function isAppleRelayEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  // Without a local part it isn't an address at all, so it can't be a relay.
  if (at === -1) return false;
  return email.slice(at + 1).trim().toLowerCase() === APPLE_RELAY_DOMAIN;
}
