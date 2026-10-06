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
> - **Updates:** this build does not download or execute replacement JavaScript bundles. App updates are distributed through the store.
> - **User content (1.2):** the only user-submitted content is the optional live
>   request / shout-out form, delivered privately to the station's DJ panel and
>   moderated by station staff. It is not shown to other users in the app —
>   there is no public feed, no user-to-user messaging and no profiles visible
>   to others.
> - **Voice assistant:** "Hey Siri, play Rádio Animu".

---

## App Privacy (App Store Connect → App Privacy)

Mirror the [data inventory](STORE_SUBMISSION.md#data-inventory-source-of-truth-for-both-stores).

**Local storage:** the stored session token, profile projection, cover cache
and settings do not by themselves add collection. Authenticated API requests
transmit the session token; assess server processing together with account data.

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
- **Photos note:** the app never reads or uploads photos — the Photos row
  covers account avatars/banners fetched from the provider/backend for display;
  the stats-card save writes to the local photo library only.
- Request content posted to the public Discord server is a disclosure to a
  third-party platform — reflect it under the User Content row.

## Demo account (2.1(a))

Create a throwaway Animu account and paste the credentials into **App Review
Information → Demo Account**. The radio plays without it, but the Requests and
Profile screens need a signed-in account.

## Age rating (2.3.6)

Answer the current App Store Connect questionnaire from the actual app behavior.

- No social feed and no user-to-user content → answer the social-media
  capability questions **No**.
- Answer content questions from the actual music, live programs and cover art.
  Let the current questionnaire determine the rating; do not choose an assumed
  minimum or use an older rating scale.
- Complete any territory-specific questions in the current console.

## Platform (2.4.1)

iPhone-only (`ios.supportsTablet: false`) → runs on iPad in compatibility mode.
Verify it launches and is usable in scaled mode on iPad before submitting.

## Sign-in (4.8)

Third-party logins (Google, Discord) are paired with **Sign in with Apple** and
email sign-in codes, satisfying the equivalent-login requirement.

## Placeholder / platform-reference items (fixed)

- No "Coming soon"/"Soon" text ships; the Android-only visualizer row is omitted
  on iOS and unavailable providers are hidden.
- The iOS assistant hint shows only the Siri phrase (no "Ok Google").
