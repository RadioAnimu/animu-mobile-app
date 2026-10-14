# Server-driven authentication release blocker

The current app/backend contract needs coordinated security work before a
production authentication claim. This is a source-based finding; no live
account, token interception or backend replay test was available in this audit.

`animu-api` builds provider-link URLs with the current session in `?sid=` and
parses a bearer session token from `animuapp://redirect?token=...`. The app's
cold-start recovery marker records that a browser flow started recently; it
does not bind the returned token to a cryptographically random app request.
SecureStore and sanitized application logs protect different exposure paths.

The app now validates the exact callback scheme, authority and root path before
parsing either login or link responses. Unexpected destinations cannot consume
the pending marker or adopt a token. This does not fix bearer-token transport,
custom-scheme interception or injection of a token into an otherwise valid
callback during a pending flow.

The backend and app need an agreed completion protocol that:

- Binds each callback to a securely generated pending app request, including
  process-death recovery, cancellation and expiry.
- Returns a short-lived, single-use completion code bound to an app-held
  verifier; exchanges it for the session over HTTPS instead of returning a
  reusable bearer session in a browser/redirect URL.
- Starts provider linking with an authenticated, account-bound operation
  without putting the existing bearer session into a browser URL.
- Tests wrong-state, intercepted-code, replay, expired-code, switched-account,
  cancellation and cold-start cases with a disposable account and backend access.

These are protocol requirements to agree with the backend, not invented endpoint
names or a claim that it already implements them. Changing the app alone to
require unavailable server fields would break the intended login/link flows.

The security inference follows [RFC 8252 sections 8.1 and 8.9](https://www.rfc-editor.org/rfc/rfc8252)
on native redirect interception and request binding, and [RFC 9700 section 2.1.2](https://www.rfc-editor.org/rfc/rfc9700)
on bearer tokens in authorization responses. Provider-side state/PKCE on the
backend does not by itself establish protection for the final native handoff.
