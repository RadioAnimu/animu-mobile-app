# Google Play Review Notes

Google Play-specific submission notes. Shared facts, data inventory and the
privacy policy edits live in [`STORE_SUBMISSION.md`](STORE_SUBMISSION.md).

---

## Data safety (Play Console → App content → Data safety)

The listing currently declares **"No data collected"** — that is inaccurate and
must be corrected to match the [data inventory](STORE_SUBMISSION.md#data-inventory-source-of-truth-for-both-stores).

**Account/request data collected** (optional). Automatic operational headers
and server logs must also be assessed against the backend’s actual retention
and use; do not label all transmitted data optional.

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
- **Photos note:** the app never reads or uploads photos. The row above covers
  account avatars/banners (uploaded via the website, fetched for display). The
  stats-card save writes to the device's own photo library via MediaStore and
  transmits nothing; it adds no collection.
- **Not collected:** location, financial info, health, messages, contacts,
  calendar, web browsing, files/docs.
- **Shared:** assess the backend’s onward disclosure too. Request content
  posted to Discord must be disclosed unless a specific Google Play sharing
  exception applies; confirm informed user consent and the applicable exception
  before choosing “not shared.”
- **Security:** data encrypted in transit (HTTPS) — yes.
- **Deletion:** users can request deletion — yes (see below).

## Data deletion (Play Console → Data safety → Data deletion)

Play requires apps with accounts to offer deletion **both in-app and via a web
URL**.

- In-app: **Account → Delete account** ✅
- Web URL: verify an accessible account-deletion request path, clearly naming
  the app/developer and explaining what is deleted or retained. A privacy page
  alone is insufficient unless it provides that path. Candidate to verify:
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
| Foreground service type | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + `foregroundServiceType="mediaPlayback"` (from `react-native-anything-player`) ✅ |
| Permission forms | Normal network/playback permissions; legacy write permission only on API ≤28; assess the media-playback FGS declaration in Play Console ✅ |
| `RECORD_AUDIO` | Blocked ✅ |
| Media/storage permissions | `READ_MEDIA_VISUAL_USER_SELECTED` and `READ_EXTERNAL_STORAGE` blocked; empty granular permissions prevent read-media requests (save-only photo flow); `WRITE_EXTERNAL_STORAGE` kept at `maxSdkVersion 28` for legacy saves ✅ |
| `versionCode` | Bump before upload (currently 16) ✅ |
| AAB | Production profile builds an app bundle ✅ |

## Notes for review (Play Console → App review → Notes)

> Free, non-profit anime-radio client. No ads, no purchases, no analytics.
> Sign-in (Google / Discord / Apple / email code) is optional — playback works
> anonymously. Account deletion is available in-app. This build does not
> download replacement JavaScript bundles; app updates use the store.

## Store listing copy

- **App name:** Animu Radio (max 30 chars)
- **Short description (max 80):** `Brazil's most moe otaku radio — anime songs, live shows and requests.`
- **Full description:** reuse the Play listing text (non-profit Brazilian otaku
  radio, anime songs / openings / endings / vocaloid / rhythm-game music, live
  DJ schedule, listener requests, Discord community).
## Update-review checklist

- [ ] Data safety corrected
- [ ] Data deletion URL set
- [ ] Content rating confirmed
- [ ] `versionCode` bumped
- [ ] Release build includes the Proxima Nova font
- [ ] Release notes honest (bug fixes vs features)
