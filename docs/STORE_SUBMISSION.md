# Store Submission

Master checklist and shared facts for releasing the Animu mobile app on the
**Apple App Store** and **Google Play**. Per-store detail lives in:

- Apple → [`APP_STORE_REVIEW_NOTES.md`](APP_STORE_REVIEW_NOTES.md)
- Google Play → [`PLAY_STORE_REVIEW_NOTES.md`](PLAY_STORE_REVIEW_NOTES.md)

Shared docs: [`LICENSE`](../LICENSE), [`NOTICE`](../NOTICE).

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

## Privacy policy — exact edits (live at <https://www.animu.com.br/privacypolicy>)

The live policy is Termly boilerplate and does not match the app. Apply these
four edits (paste-ready text) before submission:

**1. §1 "WHAT INFORMATION DO WE COLLECT?" — replace the bullet list with:**

> The personal information we collect depends on how you use the Services and
> may include:
>
> - usernames and display names;
> - email addresses (only if you sign in with Animu Connect or link an email);
> - sign-in provider identifiers (e.g. Discord, Google or Apple account IDs and
>   profile handles), plus avatar and banner images associated with the account;
> - content of music requests and live requests/shout-outs (including the name,
>   city, artist, song and message you choose to provide);
> - date and time of requests;
> - IP addresses;
> - device and app operational data sent with every request (app version,
>   platform, operating system, device model, language and region).

**2. §6 "HOW LONG DO WE KEEP YOUR INFORMATION?" — replace the "In Short" line
and first paragraph with:**

> In Short: We keep account data until you delete your account; request content
> is kept for moderation and public display; server logs are kept briefly.
>
> We retain account information (sign-in identifiers, username, email, avatar
> and banner) for as long as your account exists and until you delete it.
> Music and live request content is retained for moderation purposes and, where
> it has been published, remains displayed on our public Discord server and
> homepage (removable on request). Server logs containing IP addresses are kept
> for a limited period for security and moderation. Local data on your device
> (session token, settings, cached artwork) stays on your device until you log
> out, clear it, or delete the account.

**3. §8 / §14 — add the in-app deletion route.** After the sentence about
submitting a data subject access request, add:

> You can also delete your account and associated data directly in the mobile
> app: **Account → Delete account**. The app clears your local session and the
> server deletes the account and its personal data.

**4. §10 US-state table — fix the contradiction.** The table currently marks
**A. Identifiers** and **B. Personal information** as "NO" while §1 states
usernames, IP addresses and Discord account IDs are collected. Mark **A** and
**B** as collected and keep the retention note ("Category A/B – as long as the
user has an account with us"); leave the remaining categories "NO".

## Pre-submission checklist

### Shared
- [ ] Privacy policy updated per the four edits above (they are **not yet
      applied** to the live page)
- [ ] `pnpm run lint` + `pnpm exec tsc --noEmit` + `pnpm test` green
- [ ] iOS/Android builds include the Proxima Nova font
      (`../src/assets/fonts/README.md`; EAS secret or local files)

### Apple
- [ ] App Privacy answers set from the inventory (see Apple doc)
- [ ] Demo account added to App Review Information
- [ ] Age rating questionnaire answered (incl. social-media questions)
- [ ] Notes for Review pasted (Apple doc)
- [ ] Privacy manifest present; iPhone-only build

### Google Play
- [ ] **Data safety** corrected in the live listing (declares "No data
      collected" today — inaccurate; answer from the table in the Play doc)
- [ ] **Data deletion** web URL set in Play Console
- [ ] Content rating questionnaire answered
- [ ] `versionCode` bumped (currently 15)
- [ ] Target API 36 / foreground service `mediaPlayback` (already configured)
