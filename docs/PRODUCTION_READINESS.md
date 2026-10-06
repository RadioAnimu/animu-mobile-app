# Production readiness audit — 6 October 2026

The engineering fixes are committed on the application’s `main` and the two
library default branches. Feature branches are preserved. Apple distribution
signing and submission are deferred at the owner’s request. The application
must not be described as store-ready until the external and authenticated
verification items below are completed.

## Findings by severity

### Critical

No critical finding identified in the inspected code and executed checks.

### High

- **Session credentials persisted in plaintext — fixed.** The user projection
  serialized the session token into AsyncStorage. Persistence now excludes it;
  SecureStore restores the credential, old plaintext projections are scrubbed,
  and migration waits for secure storage instead of falling back to plaintext.
  Authentication/storage regression tests cover unavailable storage, migration,
  logout, and invalid flow timestamps. This mattered because a local data
  extraction could disclose an authenticated session.
- **Patched dependency vulnerabilities — fixed.** `source-map-js` 1.2.1 was
  resolved through application/library build dependencies. All three trees now
  pin 1.2.2. The player documentation site also used vulnerable Vite/esbuild
  versions; Vite 6.4.3 and its updated esbuild pass the site build. Frozen installs,
  package builds, and raw dependency audits verify the resolved fixes.
- **Incorrect Google Play privacy declaration — remains a submission blocker.**
  The public listing still states “No data collected” and “No data shared,”
  while the current app supports accounts and transmits request/user data.
  The listing can represent an older released build; the declaration must be
  reconciled with this release’s actual client and backend behavior before upload.
  Console access and station-operator confirmation of retention, deletion,
  and Discord disclosure are required. Repository documents are proposals,
  not proof that the public policy or console has been changed.
- **Jenkins password disclosed in conversation — rotation remains required.**
  The value was not reproduced in commits or reports. Its owner must rotate it
  and review active sessions/access. No account password was silently changed.

### Medium

- **Full native lint was bypassed — fixed.** Worklets/Reanimated applied Kotlin
  scripts in a layout that crashed Android Lint’s K2 analysis; their published
  scripts also disabled vital lint. Focused pnpm patches inline the existing
  prefab/PCH logic and restore lint. Full `:app:lintRelease` and player release
  unit tests now run as mandatory release stages. A clean Expo prebuild and
  full local release lint passed, exposing genuine application diagnostics.
- **Splash-screen API mismatch — fixed.** Expo generated an API 33 platform
  attribute in unqualified resources used on API 24+. A finalized config plugin
  keeps the base splash compatible and writes a complete `values-v33` style,
  preserving the parent and all other splash items. Regression tests verify
  both SDK variants, unrelated styles, and repeatability; release lint passes.
- **Legacy storage configuration/denial handling — fixed.** The save-only stats
  flow inherited broad legacy-storage configuration and tried saving after a
  nonpermanent denial. WRITE permission is limited to API ≤28, the legacy-storage
  opt-out is removed, Android 10+ uses MediaStore without a storage prompt, and
  denial stops saving. Six tests cover platform/version boundaries and denial.
- **Gesture-handler iOS selector collision — fixed.** A long-press timer callback
  was named like a `CGFloat` property getter, producing conflicting return
  types and an unintended getter implementation. A pinned patch renames the
  callback and all scheduling/cancellation selectors; the public configuration
  property and gesture behavior are preserved. Release compilation verifies it.
- **Stale player repository/native names — fixed.** Upstream renamed Airwave to
  `react-native-anything-player` and made it public. Package links, submodule
  path/URL, native imports, CocoaPod/Gradle references, Expo plugin, Jenkins job,
  and documentation now use the canonical repository. Fresh public checkout,
  both native builds, and upstream CI validate the migration. The temporary
  deploy key and corresponding Actions/Jenkins credentials were removed.
- **Unsafe/inconsistent library preparation — fixed.** API and player compilation
  now follow a shared pinned-source/artifact contract while retaining their own
  pnpm/Yarn toolchains. Clean exact-commit outputs are verified by SHA-256 stamps.
  Successful Jenkins artifacts are accepted only for the pinned commit; archives
  reject traversal, links, invalid entries, oversized content, and missing exports.
  Thirteen tooling tests cover the quality gates, signing, audits, and artifacts.
  Actual downloads reused API Jenkins #23 and player #4 for their exact revisions.
- **Inaccurate scan coverage and weak warning handling — fixed.** The root tools
  previously traversed a linked library using the wrong toolchain and could
  retain obsolete workspace folders. Explicit workspace boundaries now give each
  library a mandatory independent check. React Doctor must produce a complete,
  nonempty report without skipped checks. SonarQube unavailability fails instead
  of skipping; the service was restored and its existing quality gate passes.
- **Shallow Jenkins submodule history — fixed.** The new secret gate exposed an
  old shallow checkout. Initialization now fetches complete remote branch history
  without moving local feature branches or gitlinks. Secret scanning refuses
  shallow repositories and checks all available history plus current files in
  each repository with a checksum-pinned Gitleaks binary.
- **Compiled artifact flag parsing — fixed.** The new validator initially
  expected textual `mediaPlayback`; bundletool emits the typed value
  `0x00000002`. It now checks the actual bit while still rejecting unrelated
  service types. Eight tests and a real signed AAB verify the parser; all 46
  shipped 64-bit libraries pass ELF checks, and APK zip alignment/checksums pass.
- **Two unpatched high-severity tool advisories — remaining debt.** Raw audits
  report `node-forge` GHSA-86w9-cpqp-85rv and `braces` GHSA-vfj7-8cjw-p6xm. Reviewed
  exposure is Expo certificate tooling/repository-controlled glob processing,
  outside the shipped mobile bundle. There is no published fix. The gate permits
  only reviewed versions/paths; new runtime paths and unknown high/critical
  findings fail. Findings remain printed, not hidden through global audit ignores.
  Reassess when upstream publishes fixes; this is not a vulnerability-free tree.
- **Player build-tool audit debt — remains.** Moderate findings include unsupported
  ESLint/Jest transitive tooling, `glob`/`inflight` deprecations,
  `fast-xml-parser` GHSA-gh4j-gqv2-49f6, and `sprintf-js` GHSA-hp3w-g68c-fv3c.
  The affected XML builder is not used by the inspected CLI flow; sprintf formatting
  receives tool-controlled input and has no published fix. Major tool upgrades
  require React Native/Expo compatibility work. These do not establish an
  exploitable mobile runtime vulnerability, but remain explicitly tracked debt.
- **Authenticated live flows — unverified, blocks a full production claim.**
  No disposable account was supplied. OAuth redirects, provider linking, email
  codes, request submission, session expiration, and server-side account/data
  deletion need real end-to-end verification. Mocked tests cannot prove backend
  configuration or deletion. A securely supplied disposable account and backend
  operator access are required; no messages or test requests were submitted to DJs.

### Low

- **Incorrect icon file extension — fixed.** Expo wrote PNG bytes as `.webp`.
  Generation now renames only confirmed PNG launcher resources, retaining bytes
  and resource identifiers. Tests preserve actual WebP files; 15 lint warnings
  are eliminated without changing the artwork.
- **Static-analysis maintainability debt — fixed.** Component props and constants
  are readonly where appropriate, deprecated React ref types are updated, test
  assertions use precise matchers, and artwork hashing retains existing cache
  identity including surrogate pairs. Listening statistics reject nonfinite
  ranges instead of risking an unbounded loop. No test was deleted or coverage
  floor reduced. Sonar reports zero unresolved issues.
- **Native compatibility warnings — reviewed, remain upstream debt.** React Native,
  Expo, screens, WebView, and related pods retain legacy bridge/UIKit declarations,
  Swift concurrency annotations, generated C++ initializers, and unused helpers.
  The Expo factory inherits its host-start implementation; an unused constants
  header declaration is not called by the app. Cache hashing uses MD5 for
  deduplication, not credential verification. These are not blanket-suppressed.
- **Gradle/CMake noise — partly fixed.** The unused assembly cache-launcher argument
  was removed. Upstream Gradle DSL deprecations concern future Gradle versions;
  the pinned current build passes. SDK XML parser-version messages are tool-version
  compatibility warnings rather than missing platform components.

### Informational

- Gitleaks initially reported 70 historical copies of the same TypeScript union
  declaration as a LinkedIn credential. Every occurrence was reviewed. The
  exception matches only that exact line and file path; a synthetic credential
  beside it still fails. Inline allow-comments cannot bypass scanning.
- The Android device helper sometimes captured only SystemUI while the app
  was playing. Native media-session state, screenshots, and crash logs provide
  separate runtime evidence; deterministic playback-time accessibility/E2E
  automation remains to be established.
- Sonar’s fixed-hour histogram and fixed-digit verification slots use semantic
  indexes; their reviewed false positives were resolved individually. `typeof
  __DEV__` remains necessary when the ambient binding is absent in Node.
- Expo’s managed-version check intentionally excludes WebView and view-shot;
  these selected versions are validated by native builds rather than asserted
  compatible solely through a green dependency check.

## Validation scope and evidence

- Application: **74 files / 736 tests**, statement/branch/function/line coverage
  **69.84 / 65.08 / 61.73 / 70.34%**; existing floors retained. Lint uses zero
  tolerated warnings; TypeScript and Expo’s 21 checks pass. React Doctor: **100**,
  complete scan, no errors or warnings.
- API `47a34b8`: **199 tests**, coverage approximately **89.9% statements**, ESM/CJS
  builds, typecheck, and audit pass. Player `d5254b4`: **27 JS tests**, approximately
  **99.6% statement coverage**, lint/typecheck/package/documentation build pass;
  **13 Swift tests** and **8 Kotlin tests**, including **59 conformance scenarios**.
- Production JS bundle: approximately **3.06 MiB**, assets **1.71 MiB**, within the
  unchanged 3.34/1.91 MiB budgets.
- Sonar gate: zero new violations, **82.6% new-code coverage**, **0.384% duplication**;
  existing 80%/3% limits retained. GitHub also runs CodeQL.
- Android release: clean generated project, full lint and native unit tests.
  The release pipeline additionally verifies AAB format, configured package/
  versions/target SDK, absence of debug/test/cleartext flags and blocked permissions,
  the media-playback service, 64-bit ELF alignment, bundle 16 KB packaging,
  APK zip alignment, and matching non-debug upload signatures. Play App Signing
  can use a different certificate; upload signatures alone do not prove APK
  update compatibility with the Play-installed channel. Eight artifact
  validator tests reject unsafe flags, leaked permissions, and incompatible ELF.
- Android signed APK: clean-emulator install/launch, live MP3 playback, AAC
  selection, native media controls/pause, background playback, network-loss
  buffering and recovery, and the assistant play deep link were exercised.
  Expected offline DNS errors were handled; no fatal application crash appeared.
  The emulator uses 4 KB pages, so ELF/ZIP checks do not substitute for a physical
  16 KB device test. Existing development-signed emulator data was preserved.
- iOS: Release simulator build and unsigned ARM64 device archive with iOS 27 SDK;
  archive inspection found 14 privacy manifests, audio background mode, add-only
  Photos disclosure, and arbitrary-load networking disabled. Anonymous live radio,
  metadata, quality selection (AAC 64 / MP3 320), and pause were exercised in the
  simulator. This is not distribution-signing or App Store Connect validation.

## Remaining Android lint warnings

The repaired full lint report has **0 errors / 26 warnings**:

| Diagnostic | Count | Cause and disposition |
| --- | ---: | --- |
| ScopedStorage | 1 | READ permission is a manifest `tools:node="remove"` instruction, not a requested permission. Final merged-manifest gate rejects its presence. |
| UnusedAttribute | 1 | Back-invoked callback attribute is intentionally ignored on older SDKs. |
| LockedOrientationActivity / DiscouragedApi | 2 | Product is portrait; Android large-screen behavior can override this. Tablet/foldable usability still needs device verification; no speculative orientation rewrite. |
| NewerVersionAvailable | 2 | Fresco versions are selected by the validated React Native ecosystem; no uncontrolled upgrade. |
| PrivateResource | 6 | React Native’s generated EditText template uses AppCompat internal resources; keep compatible pinned versions and reassess template upgrades. |
| UnusedResources | 7 | Development/generated strings include dynamic native lookups; resource shrinker is enabled. Not evidence of release functionality that should be deleted. |
| IconLauncherShape | 5 | Legacy launcher-artwork shape recommendation; brand preserved. |
| MonochromeLauncherIcon | 2 | Optional themed icon absent; not a store-submission requirement. |

## Release/submission items still required

| Item | Why unresolved / resolution | Blocks submission? |
| --- | --- | --- |
| Apple distribution signing, signed archive export, upload validation | Explicitly deferred. Use an existing distribution identity/profile and App Store Connect mechanism later. | Apple: yes |
| Store privacy answers, public policy, deletion URL | Need operator-confirmed processing/retention and console changes. A privacy page alone is not proof of a functional web deletion route. | Yes |
| Live authentication/account deletion | Need disposable account and verification of backend behavior, not just mocked responses. | Full production assessment: yes |
| Music/artwork/font rights, review account, content ratings, FGS console declaration | Require owner attestations and current console information. Do not infer rights or current questionnaires from code. | Yes where required |
| Build-number availability | Current version 3.0.0, Android code 16, iOS build 6; compare against uploaded builds before choosing next values. | If already used |
| Physical-device/large-screen/interruption coverage | Simulator/emulator checks do not prove Bluetooth, calls, car integration, Android 16 KB runtime, or iPad compatibility. | Release verification remains incomplete |
| Unpatched build-tool findings | Track upstream fixes; keep scoped gates and input assumptions under review. | No demonstrated mobile runtime blocker; security debt remains |
| Jenkins password rotation | Owner must rotate the disclosed credential and review access. | Operational security remediation |

No store upload, npm publication, or new GitHub release was performed. Deployment
workflows were inspected; publication stages require their real distribution
artifacts/credentials and are not interchangeable with engineering validation.
Jenkins janitor is housekeeping, not a quality gate; it was not rerun while
build workspaces were active.

Authoritative references checked during this audit:
[Android target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk),
[16 KB native/packaging requirements](https://developer.android.com/guide/practices/page-sizes),
[Apple SDK minimum](https://developer.apple.com/news/?id=ueeok6yw),
[Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111),
[current public Play declaration](https://play.google.com/store/apps/details?id=com.nessjs.animu).
