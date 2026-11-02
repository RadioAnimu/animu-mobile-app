# Screenshots for PR #42

Captured on 2026-11-02 from `dev` at adb66af, logged out, with the live station.

- `sheets/`: one contact sheet per device or viewport.
- `web/<viewport>/`: the web export (`pnpm build:web`) in Chromium. The `safari-` folders use WebKit.
- `ios/<device>-<orientation>/`: the iOS Release build on the simulator.

The web shots fetch the play history and listener count through Playwright,
which adds the CORS header `www.animu.moe` sends only to the station's own
domain. If LRCLIB has no synced lyrics for the song on air, the lyrics shot
shows sample lines labelled "Letra de exemplo".
