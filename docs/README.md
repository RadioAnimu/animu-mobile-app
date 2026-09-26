# Animu Mobile App — Documentation

Everything about the official [Rádio Animu](https://www.animu.moe) mobile client,
organised by topic. The root [`README.md`](../README.md) is the quick overview;
this folder holds the detail.

| Doc | What's inside |
| --- | --- |
| [Features](FEATURES.md) | Every user-facing capability, screen by screen, with screenshot placeholders |
| [Architecture](ARCHITECTURE.md) | Layered design, the player core, state stores and key engineering decisions |
| [Development](DEVELOPMENT.md) | Prerequisites, install, scripts, tests, path aliases, patches and fonts |
| [Build & Release](BUILD_AND_RELEASE.md) | EAS profiles, versioning, over-the-air updates and voice assistants |
| [AltStore](ALTSTORE.md) | Self-hosted iOS distribution source and GitHub Pages |
| [API Surface](API_SURFACE.md) | Station endpoints and how the `animu-api` submodule is consumed |
| [Store Submission](STORE_SUBMISSION.md) | Master checklist, data inventory and privacy-policy edits |
| [App Store Review Notes](APP_STORE_REVIEW_NOTES.md) | Apple review notes, App Privacy and age rating |
| [Play Store Review Notes](PLAY_STORE_REVIEW_NOTES.md) | Play Data safety, data deletion and content rating |

## Screenshot placeholders

Store and docs screenshots are **not** committed here yet. Where a screenshot
belongs you'll find a placeholder in this form:

```md
![Home player](SCREENSHOT: description of the exact screen and state to capture)
```

The text inside the parentheses is the brief for the screenshot — capture that
screen in that state, save the image under `docs/assets/screenshots/`, then
replace the placeholder's target with the relative path.

## Documentation map by audience

- **New contributors** → [Development](DEVELOPMENT.md) → [Architecture](ARCHITECTURE.md)
- **Maintainers shipping a release** → [Build & Release](BUILD_AND_RELEASE.md) → [Store Submission](STORE_SUBMISSION.md)
- **Reviewers auditing the app** → [Features](FEATURES.md) → [Store Submission](STORE_SUBMISSION.md)
- **API consumers** → [API Surface](API_SURFACE.md) and the [`animu-api` reference](https://github.com/RadioAnimu/animu-api/blob/main/API.md)

## About the station

**Rádio Animu** was founded on April 16, 2018 and is a non-profit Brazilian
radio dedicated to otaku culture — anime songs, openings and endings, fansings,
remixes, rhythm-game music, vocaloid and more, with a live DJ schedule,
listener-driven requests and a Discord community.

- Website: [animu.moe](https://www.animu.moe) · [animu.com.br](https://www.animu.com.br)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.nessjs.animu) (`com.nessjs.animu`)
- Repo: [RadioAnimu/animu-mobile-app](https://github.com/RadioAnimu/animu-mobile-app)
