# Google Play Review Notes

Google Play-specific submission notes. Shared facts, data inventory and the
privacy policy edits live in [`STORE_SUBMISSION.md`](STORE_SUBMISSION.md).

---

## Data safety (Play Console → App content → Data safety)

The listing currently declares **"No data collected"** — that is inaccurate and
must be corrected to match the [data inventory](STORE_SUBMISSION.md#data-inventory-source-of-truth-for-both-stores).

**Data collected** (all optional — "users can choose whether to provide"):

| Play category | Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- | --- |
| Personal info | Name | Yes | No | Yes | App functionality, Account management |
| Personal info | Email address | Yes | No | Yes | App functionality, Account management |
| Personal info | User IDs | Yes | No | Yes | App functionality, Account management |
| Photos and videos | Photos (avatar/banner) | Yes | No | Yes | App functionality |
| App activity | Other user-generated content (requests/shout-outs) | Yes | No | Yes | App functionality |

- **Device or other IDs:** not declared — the app sends device model, OS, app
  version, language and region in request headers, but no device/advertising
  identifier.
- **Not collected:** location, financial info, health, messages, contacts,
  calendar, web browsing, files/docs.
- **Shared:** none with third parties from the app (data goes to the station's
  own backend). Note: request content is displayed on the public Discord server
  — if you treat that as sharing, mark the user-content row as shared.
- **Security:** data encrypted in transit (HTTPS) — yes.
- **Deletion:** users can request deletion — yes (see below).

## Data deletion (Play Console → Data safety → Data deletion)

Play requires apps with accounts to offer deletion **both in-app and via a web
URL**.

- In-app: **Account → Delete account** ✅
- Web URL: point to the privacy policy / data-subject request form, e.g.
  `https://www.animu.com.br/privacypolicy` (or the Termly DSAR link).

## Content rating (Play Console → App content → Content rating)

Answer the IARC questionnaire honestly. Expect **Teen / "Diverse Content:
Discretion Advised"** (already the current rating). The app streams anime music
and shows anime cover art; no violence, gambling, drugs, or user-to-user
content. Re-rate only if the questionnaire answers change.

## App content declarations (Play Console → App content)

- **Ads:** no ads.
- **Target audience:** not primarily for children (not in Families).
- **News / COVID / Government / Financial / Health:** no.
- **Data safety:** as above.
- **Government apps / financial features:** n/a.

## Technical status (already configured — verify on each build)

| Item | Status |
| --- | --- |
| Target API level | `compileSdk`/`targetSdk` **36** ✅ |
| Foreground service type | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + `foregroundServiceType="mediaPlayback"` (from `react-native-playback-controls`) ✅ |
| Permission forms | None required — only normal permissions (INTERNET, WAKE_LOCK, VIBRATE, MODIFY_AUDIO_SETTINGS, FGS) ✅ |
| `RECORD_AUDIO` | Blocked ✅ |
| `versionCode` | Bump before upload (currently 13) ✅ |
| AAB | Production profile builds an app bundle ✅ |

Minor: `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` leak in from
`react-native-blob-util`; harmless on modern Android, can be added to
`blockedPermissions` if unused.

## Notes for review (Play Console → App review → Notes)

> Free, non-profit anime-radio client. No ads, no purchases, no analytics.
> Sign-in (Google / Discord / Apple / email code) is optional — playback works
> anonymously. Account deletion is available in-app. The app updates its JS
> bundle over the air from its own GitHub release feed for **bug fixes only**;
> it never changes the app's features or purpose.

## Store listing copy

- **App name:** Animu Radio (max 30 chars)
- **Short description (max 80):** `Brazil's most moe otaku radio — anime songs, live shows and requests.`
- **Full description:** reuse the Play listing text (non-profit Brazilian otaku
  radio, anime songs / openings / endings / vocaloid / rhythm-game music, live
  DJ schedule, listener requests, Discord community).
- **Screenshots:** use only artwork you have rights to (see residual IP item).

## Update-review checklist

- [ ] Data safety corrected
- [ ] Data deletion URL set
- [ ] Content rating confirmed
- [ ] `versionCode` bumped
- [ ] Release build includes the licensed font
- [ ] Release notes honest (bug fixes vs features)
