# App Store Review Notes

Apple-specific submission notes. Shared facts, data inventory and the privacy
policy edits live in [`STORE_SUBMISSION.md`](STORE_SUBMISSION.md).

---

## Notes for Review (paste into App Store Connect)

> Rádio Animu is the official client for a free, non-profit Brazilian anime
> radio station. Playback needs no account; signing in only unlocks requests and
> profile features.
>
> - **No purchases.** The app is free — there are no in-app purchases or
>   subscriptions.
> - **Account deletion** is available in-app: Account → Delete account.
> - **Sign in:** Sign in with Apple is offered alongside Google, Discord and
>   email sign-in codes.
> - **Over-the-air updates (2.5.2):** the app can download JS bundles from its
>   own GitHub release feed to ship **bug fixes, security fixes and performance
>   work only**. It never adds features, screens or changes the app's purpose.
>   A bundle is applied only when its native runtime version matches the
>   installed binary.
> - **User content (1.2):** the only user-submitted content is the optional live
>   request / shout-out form, delivered privately to the station's DJ panel and
>   moderated by station staff. It is not shown to other users in the app —
>   there is no public feed, no user-to-user messaging and no profiles visible
>   to others.
> - **Voice assistant:** "Hey Siri, play Rádio Animu".

---

## App Privacy (App Store Connect → App Privacy)

Mirror the [data inventory](STORE_SUBMISSION.md#data-inventory-source-of-truth-for-both-stores).

**Data Not Collected:** on-device only — session token, profile projection,
cover cache, settings.

**Data Collected — linked to the user, used for App Functionality, not for
tracking:**

| Apple category | Item | Optional |
| --- | --- | --- |
| Contact Info | Name | Yes |
| Contact Info | Email Address | Yes |
| User Content | Photos (avatar/banner) | Yes |
| User Content | Other User Content (requests/shout-outs) | Yes |
| Identifiers | User ID | Yes |

- **Tracking:** No → no ATT prompt.
- **Data linked to the user:** Yes for the items above.
- **Data used to track you:** No.
- Request content posted to the public Discord server is a disclosure to a
  third-party platform — reflect it under the User Content row.

## Demo account (2.1(a))

Create a throwaway Animu account and paste the credentials into **App Review
Information → Demo Account**. The radio plays without it, but the Requests and
Profile screens need a signed-in account.

## Age rating (2.3.6)

Answer the App Store Connect questionnaire honestly. From **September 2026** the
social-media capability questions are mandatory for submissions and updates.

- No social feed and no user-to-user content → answer the social-media
  capability questions **No**.
- It streams anime music and displays anime cover art fetched at runtime. A
  **12+** rating is the realistic floor; choose **17+** for margin on suggestive
  covers.
- Korea (from Oct 2026): "infrequent mature or suggestive themes" moves to 12+.

## Over-the-air updates — policy to keep (2.5.2)

- Ship only bug fixes, security fixes and performance work over OTA.
- Never ship new features, screens or purpose-changing flags via OTA.
- Keep the runtime-version guard in `src/core/ota/ota.service.ts`.
- `.github/workflows/ota.yml` publishes the bundles; keep release notes honest.

## Platform (2.4.1)

iPhone-only (`ios.supportsTablet: false`) → runs on iPad in compatibility mode.
Reviewers test on iPhone 17 Pro Max and iPad Air 11" (M3); verify it launches and
is usable in scaled mode on iPad before submitting.

## Sign-in (4.8)

Third-party logins (Google, Discord) are paired with **Sign in with Apple** and
email sign-in codes, satisfying the equivalent-login requirement.

## Placeholder / platform-reference items (fixed)

- No "Coming soon"/"Soon" text ships; the Android-only visualizer row is omitted
  on iOS and unavailable providers are hidden.
- The iOS assistant hint shows only the Siri phrase (no "Ok Google").
