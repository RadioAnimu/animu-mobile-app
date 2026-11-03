# App Store Review Notes

Apple-specific submission notes. Shared facts, data inventory and the privacy
policy edits live in [`STORE_SUBMISSION.md`](STORE_SUBMISSION.md).

---

## Notes for Review (paste into App Store Connect)

As submitted with 4.1.0. The review account's email and code live only in
App Store Connect → App Review Information; never commit them.

> Rádio Animu is the official app of Rádio Animu (www.animu.com.br), a free, non-profit Brazilian anime web radio. Playback needs no account; signing in only unlocks song requests, the profile and the listening card.
>
> Content: the app plays only the station's own live broadcast, streamed from the station's servers (stream.animu.moe). It is not a directory of third-party stations, and it does not download, record or re-stream audio. Song titles and cover art come from the station's own API, the same data shown on the station's website. Synced lyrics are fetched on demand from LRCLIB (lrclib.net), a public lyrics database, and are not stored or redistributed by the station. The station's original content is licensed CC BY-NC-SA 4.0, as stated in the app under Settings > About.
>
> Demo account: on the sign-in screen, tap "Sign in with an email code", enter <review account email>, then enter the code <review code>. No inbox is needed: this review account accepts that fixed code.
>
> Song requests: to stop spam, the station only accepts requests from accounts with a linked Discord account that has two-factor authentication on. The demo account can search the library and see the request screen, but sending a request shows that requirement instead. Everything else (playback, lyrics, history, stats, settings) works with the demo account.
>
> - No purchases: the app is free, with no in-app purchases or subscriptions.
> - Account deletion is in the app: Account > Delete account.
> - Sign in with Apple is offered alongside Google, Discord, Fluxer and email codes.
> - The build does not download or run replacement code; updates ship through the store.
> - User content: signed-in listeners can request a song from the station's library; the request list in the app and on the station's website shows the song and the requester's display name. The optional live shout-out (name, city, message) goes to the station's DJ panel, where station staff moderate it, and may be read on air or posted on the station's Discord server; staff can remove any entry. There is no user-to-user messaging and no public profiles.
> - Siri: "Hey Siri, play Rádio Animu".
> - The interface follows the device language: Portuguese, English, Spanish or Japanese.

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

iPhone and iPad (`ios.supportsTablet: true`). The app must stay universal: 2.0.5
shipped with iPad support, and App Store Connect refuses an update that drops a
device (QA1623). Check the tablet layouts on an iPad before submitting.

## Sign-in (4.8)

Third-party logins (Google, Discord) are paired with **Sign in with Apple** and
email sign-in codes, satisfying the equivalent-login requirement.

## Placeholder / platform-reference items (fixed)

- No "Coming soon"/"Soon" text ships, and unavailable providers are hidden.
- The iOS assistant hint shows only the Siri phrase (no "Ok Google").
