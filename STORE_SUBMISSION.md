# Store Submission

Master checklist and shared facts for releasing the Animu mobile app on the
**Apple App Store** and **Google Play**. Per-store detail lives in:

- Apple → [`APP_STORE_REVIEW_NOTES.md`](APP_STORE_REVIEW_NOTES.md)
- Google Play → [`PLAY_STORE_REVIEW_NOTES.md`](PLAY_STORE_REVIEW_NOTES.md)

Shared licensing/attribution docs: [`LICENSE`](LICENSE), [`NOTICE`](NOTICE),
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## What the app is

Official client for **Rádio Animu**, a free, non-profit Brazilian anime radio.
Playback works anonymously; signing in only unlocks requests and profile
features. No ads, no in-app purchases, no subscriptions, no analytics/tracking.

- Bundle ID: `com.nessjs.animu`
- Platforms: Android (Play), iOS (App Store)
- iOS is **iPhone-only** (`ios.supportsTablet: false`)

## Data inventory (source of truth for both stores)

Traced from the code. "Collected" = transmitted off-device; "on-device" data is
not collection.

| Data | Destination | Optional? | Retention | Third parties |
| --- | --- | --- | --- | --- |
| Name / username | station backend (auth) | Yes — only if you sign in | Until account deletion | No |
| Email address | station backend (auth) | Yes — only if you sign in | Until account deletion | No |
| User IDs (provider, handle) | station backend (auth) | Yes — only if you sign in | Until account deletion | No |
| Avatar / banner (photos) | station backend (auth) | Yes — only if you upload | Until account deletion | No |
| Music request (name, track) | station backend (requests) | Yes — sign-in + submit | Persisted; shown on station homepage | Public on station site |
| Live request / shout-out (name, city, message) | station backend (DJ panel) | Yes — message field is optional | Persisted; shown on Discord | Posted to Discord |
| Client headers (platform, app/build version, language, device model, OS, region) | every API call | Automatic | Server logs | No |
| IP address | server logs | Automatic | Server logs (moderation) | No |
| Session token | iOS Keychain / Android Keystore | Yes | Until logout/deletion | On-device only |
| Profile projection | AsyncStorage | Yes | Until logout/deletion | On-device only |
| Cover cache, settings | device storage | Automatic | Local cache | On-device only |

Key point: account and request data are **optional but retained** (until
deletion, or publicly displayed for requests) — not temporary. Local caches are
temporary and never transmitted.

## Privacy policy — required edits

The policy at <https://www.animu.com.br/privacypolicy> must match the inventory:

- **Retention:** replace the generic "as long as necessary" with concrete
  periods (e.g. account data until deletion; request content retained for
  moderation + public display).
- **Public display:** keep the statement that requests are shown on the public
  Discord server and station homepage (already present).
- **Consistency:** the US-state table marks Identifiers/Personal info as "NO"
  while the section above lists them as collected — fix so it is internally
  consistent.
- **Deletion:** mention the in-app **Account → Delete account** path in addition
  to the web request form.

## Licensing / IP

- App **source code**: MIT (`LICENSE`). Station **content**: CC BY-NC-SA 4.0.
- Third-party artwork and the commercial Proxima Nova font are documented in
  `THIRD_PARTY_NOTICES.md`; the font is not shipped in the repo.
- **Residual IP item:** the binary bundles a commercial anime cover
  (`src/assets/covers/sample-cover-*.jpg`) and a third-party anime collage
  background (`src/assets/make_request_harukinha_*.webp`), and the AltStore
  screenshots embed copyrighted anime covers. Replace with the station's own art
  or document permission before submitting (both stores reject unlicensed
  third-party content).

## Pre-submission checklist

### Shared
- [ ] Privacy policy updated per the edits above
- [ ] Store screenshots use only artwork you have rights to
- [ ] `npm run lint` + `npx tsc --noEmit` + `npm test` green
- [ ] iOS/Android builds include the licensed Proxima Nova font
      (`src/assets/fonts/README.md`; EAS secret or local files)

### Apple
- [ ] App Privacy answers set from the inventory (see Apple doc)
- [ ] Demo account added to App Review Information
- [ ] Age rating questionnaire answered (incl. social-media questions)
- [ ] Notes for Review pasted (Apple doc)
- [ ] Privacy manifest present; iPhone-only build

### Google Play
- [ ] **Data safety** corrected (currently "No data collected" — inaccurate)
- [ ] **Data deletion** web URL set in Play Console
- [ ] Content rating questionnaire answered
- [ ] `versionCode` bumped (currently 13)
- [ ] Target API 36 / foreground service `mediaPlayback` (already configured)
