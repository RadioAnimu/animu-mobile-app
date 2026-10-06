# ICY / Rádio Animu UI and interaction audit

Audit performed on 6 October 2026. The existing purple, lime, Proxima Nova, sticker artwork, hard shadows and Material icon language have been retained. This is an implementation and verification record, not a claim that untested platforms passed.

## Design system

The existing `src/theme` remains the source of truth. Added or consolidated semantic success, warning, information, field placeholder, shadow, auth vignette, chart and cache-category colors; toast elevation; feedback reading durations; input opacity; 48 dp touch targets; button, sheet handle and code-box dimensions; shared flow width; chart geometry; and scroll event cadence. Existing branded illustration geometry remains deliberately authored rather than mechanically rounded to a new grid.

- Palette: lime `#6BDB00`; violet surfaces `#270052`, frame `#42008C`, deep background `#160135`; white primary text and existing translucent secondary text; error `#F87171`; destructive action `#C01B31`. Live broadcast red remains a distinct branded state.
- Typography: existing Proxima Nova regular/bold and caption, label, body, list, subhead, heading and title hierarchy. Controls grow vertically and labels wrap instead of shrinking to fit. Large player text becomes static, wrapping text above the chrome font-scale threshold.
- Spacing/radii: existing `SPACE`, `RADIUS`, `BORDER_WIDTH`, screen and flow recipes remain authoritative. Removed duplicate footer gaps rather than adding new compensating padding.
- Motion: instant 0 ms, fast 75 ms, normal 110 ms, slow 150 ms, splash 125 ms; entrance stagger 20 ms; spring speed 60 with no bounce. These halve the previous app-owned transition timings. Reading times, caret cadence and metadata scrolling remain suitable for reading. Android native navigation timing remains OS-controlled.
- Component recipes consolidated around `PrimaryButton`, `SheetButton`, `FormField`, `EmailCodeFields`, `CodeInput`, `Sheet`, `Toast`, `KeyboardScrollView` and `KeyboardFormRegion`.

## Implemented fixes

| Area | Inconsistency / failure | Result |
| --- | --- | --- |
| Account / Login code flow | Input focus raced step replacement; keyboard could stay hidden | Focus waits for native mount/layout and a modal's `onShow`; outgoing auto-focus race removed; numeric input uses one real native field |
| Forms and native sheets | Keyboard could cover the next action, and padding could leave a giant footer | One inset owner; runtime keyboard metrics; measured field and form footer; minimum necessary scroll; hide resets layout |
| Live and music requests | Failed submission closed Gboard even though the native input remained mounted | Busy no longer changes opacity on the input's ancestor. Controlled device experiments isolated that change; failed-submit focus and IME visibility now remain intact in both forms |
| Request submission | Repeated sends / drafts disappearing on dismissal | Submission guards; disabled busy action; same-owner draft preservation; clear only on success, different track or different account |
| Sheet safe area | Sheet footer gap plus inner scroll footer plus button margin | One content gap and one runtime bottom inset; safe side insets; keyboard avoidance reduces available viewport |
| Bottom inset ownership | Login and sheets already cleared the bottom inset, while Account did not | Shared viewport explicitly distinguishes consumed and unconsumed insets |
| Home scrolling | Overscroll exposed artwork behind the pinned header | Pinned header with bounce and Android overscroll disabled on the player scroll container |
| Native navigation | Theme used light defaults; detail transitions could feel disconnected | Dark semantic navigation palette; brief iOS push; reduced-motion fade; native Android push/back retained |
| Notifications | Dialogs vanished after a timeout; messages could truncate or compete | Dialogs require acknowledgment; one toast at a time; longer errors; Android recommended accessibility timeout; full message text; local sheet feedback remains above the native modal |
| Toast and keyboard | Feedback could travel from top to bottom when keyboard closed | Placement captured when created, retained for its lifetime |
| Playback | Native error mapped to paused; errors swallowed; missing metadata looked inert | Explicit error/connecting/reconnecting/missing-metadata feedback and retry; guarded playback action; failures reach UI |
| History | Refresh could update the wrong collection or silently hide failure | Requested/played refresh their own data; explicit refresh failures reach error feedback; existing content remains during refresh |
| Disabled request items | Appearance suggested disabled but interaction remained available | Native action disabled, matching accessibility state and pressed behavior |
| Controls | Fixed heights clipped scaled text; several icon/clear/reveal actions were small; inactive bitrate options were brighter than the selected one | Growing buttons/inputs, shared 48 dp targets, wrapping labels, consistent tint and pressed opacity; selected bitrate uses the lime accent |
| Stats | Dense tiny heatmap targets and ambiguous day-empty state | Accessible previous/date/next controls; tiny cells excluded from screen-reader order; specific day-empty copy; calendar arithmetic handles DST |
| Stats / About | Long rows, values and counts conflicted with layout | Flexible rows/labels, wrapping or stacking where appropriate, consistent chart tokens and singular file grammar |
| Motion accessibility | Marquees, caret, blinking and visualizer kept moving | Reduced-motion alternatives; background marquee stops; decorative visualizer excluded from accessibility |
| Localization | Missing block detail produced empty quoted names; new state text lacked translations | Generic block message fallback; new player/day/control text supplied in the existing PT/EN/ES/JN dictionaries |

The input-parent opacity experiment establishes the behaviorally relevant cause on this RN 0.86 Android build. Fabric/native ancestry changes are the likely mechanism; no speculative React Native patch or forced blur/refocus workaround was shipped.

## Haptics and feedback

Existing haptic preferences remain authoritative. Meaningful account/code and request success/failure use semantic success/error feedback; bitrate selection only emits selection feedback when it changes. Passive refresh no longer emits selection feedback. No scrolling or passive animation haptics were added. The emulator cannot establish tactile quality on hardware.

## Screen and state coverage

All source screens and their shared components were inspected. Runtime coverage below refers to actual emulator interactions; local fixtures substituted responses for controlled content/error scenarios or actions that would send mail/requests. A stale audit proxy initially blocked real network requests; the post-audit cleanup and live verification are recorded below.

| Screen / surface | Runtime scenarios exercised |
| --- | --- |
| Loading / launch | Cold launch, development build and release build startup |
| Home / player | Missing metadata and recovery, artwork placeholder, long track/artist/anime, live programme, bitrate selection, menu, pinned-header overscroll, programme sheet |
| Requested history | Populated long content, scroll, pull gesture / refresh, drawer navigation |
| Played history | Navigation, collection-specific refresh implementation and automated coverage |
| Make Request | Existing recent search, populated long results, disabled result, sheet presentation, keyboard, error, retry, success; source/automated coverage for empty/error search states |
| Live request | Required-field validation, focus first invalid field, Gboard Next chain, all required fields, optional multiline input, last field plus Send visibility, failure retaining IME, successful retry, repeat opening/dismissal |
| Settings | Account/Stats/Storage/About navigation, disclosure rows and switches, native back |
| Account | Email typing, Send visible above keyboard, automatic numeric focus, invalid code, success, change email, manual keyboard dismissal/reopen, background/foreground, large text |
| Login | Signed-out local bootstrap, provider method layout, Animu Connect email and numeric code, invalid code, back; provider/browser/server integration inspected but not invoked |
| Stats | Cached content, cards, day previous/next, disabled future navigation, empty day, expanded sections, small screen and large text |
| Storage | Limit and custom partitions changed and restored, cached usage, labels and controls |
| About | Content and expanded donors, typography and long detail layouts |
| Programme sheet | Long description, independent scrolling, close/drag behavior, safe bottom spacing |
| Global feedback | Source/automated dialog acknowledgment and notification replacement; actual sheet errors/success feedback |

Normal, loading, empty, offline/error, disabled, refreshing and submitting branches were inspected where meaningful. Destructive account/reset actions, external provider login, public request submission and external sharing were not executed against live services.

## Device verification

Device Hub inventory exposed one Android emulator and no physical devices. iOS was explicitly unavailable: this Linux host has no macOS/Xcode simulator tooling.

| Configuration | Verification |
| --- | --- |
| Pixel 7 AVD, Android 16 / API 36, x86_64, 1080 × 2400, density 420 | Debug installed and driven through the shared Device panel with taps, swipes, scrolling, back, sheets, Gboard typing and keyboard transitions |
| Same AVD, 1080 × 1920, density 540 (about 320 × 569 dp), 200% font scale | Home, drawer, Settings, Account, Login and Stats; email/code keyboard and recovery; three-button navigation |
| Gesture / three-button navigation | Runtime system insets inspected in both configurations |
| System light / dark | Existing intentionally dark-only app checked under both system modes; no unrelated light theme invented |
| Remove animations / default scale | System preference toggled; reduced-motion implementation inspected and exercised in navigation/content |
| Background / foreground | Account code/error state retained; manually dismissed keyboard can be reopened |
| TalkBack | Installed service would not bind (`Bound services: {}`, touch exploration false), despite enable attempts. Accessibility tree, labels, state and modal isolation inspected; spoken traversal remains unverified |
| iOS / physical Android | Unavailable; not tested |

Font scale, display size/density, navigation mode, animation scale, system appearance and tested storage preferences were restored. Original 320 kbps selection restored. Gboard was used, not the headless test IME. Existing API submodule changes were preserved. Temporary fixtures and tracing are absent from the production entry point and components; fixtures did not send real email or station requests. Follow-up cleanup also disabled the emulator's stale `10.0.2.2:8899` global HTTP proxy, removed its ADB reverse mapping, and updated the staged entry point to remove the obsolete fixture import and LogBox suppression.

## Visual evidence

Screenshots are local artifacts. Some development-build screenshots include Expo's floating development control, which is not shipped UI. Long metadata and successful/failed request responses are local fixtures.

- Account email keyboard: [before](account-keyboard-before.png), [after](account-keyboard-after.png).
- Code input: [numeric keyboard](account-code-keyboard-after.png), [error and recovery](account-code-error-after.png).
- Small screen / 200% text: [Account email](account-small-keyboard-after.png), [Account code](account-code-small-after.png), [Login email](login-small-keyboard-after.png), [Login code](login-code-small-after.png), [Home](home-small-large-text-after.png), [Stats](stats-small-large-text-after.png).
- Native sheets: [music request keyboard](request-sheet-keyboard-after.png), [music request error](request-sheet-error-after.png), [live validation](live-validation-keyboard-after.png), [live final field](live-last-field-keyboard-after.png), [live error retaining keyboard](live-error-keyboard-after.png), [programme](program-sheet-after.png).
- Other screens: [history](history-after.png), [Stats](stats-after.png), [Storage](storage-after.png), [About](about-after.png), [long player metadata](home-long-metadata-after.png), [release metadata-unavailable recovery](home-offline-release-after.png).

Some branded fixture captures show intermediate visual states; the keyboard/error and small-screen captures are the stronger final interaction evidence. The [live release Home screen after proxy cleanup](home-live-release-after.png) records successful real metadata loading. This is a targeted before/after record, not a complete automated visual regression suite.

## Validation and limits

- TypeScript: passed.
- ESLint with zero warnings allowed: passed.
- Vitest: 748 passing tests across 76 files. Added meaningful coverage for mounted/presented focus timing, viewport scroll calculation, same-frame email submission, draft preservation, history refresh error propagation and missing block details; updated affected transport/dialog behavior tests.
- React Doctor: baseline 100/100; final changed-scope 100/100. Focused design scan has only the existing two test image mock warnings.
- Android debug native build/install: passed. Release `assembleRelease` also passed (x86_64); the final rebuild also passed after the reveal-target and bitrate-state fixes; release sampling is recorded below.

The release APK was installed and checked again: Home recovery, Account email/keyboard and native back, Stats day details, Storage and About. Those initial release checks still had a stale audit proxy configured, so they establish layout/error/cached-content behavior rather than successful live integration. Release screenshots replace the Account email, Stats, Storage and About overview captures. After removing that proxy and restarting the same release APK, real track metadata, listener count and programme information loaded successfully. The earlier claim that station APIs were unavailable was incorrect for this final release check.

The debug emulator frame sample reported 126 missed/deadline frames out of 262 (48.1%) during launch, navigation and instrumentation. It includes development overhead and an emulated CPU/GPU; it is not evidence of smooth physical-device production performance. A warmed release sample reported 135 missed frames out of 253 (53.4%) over about 71.7 seconds, including navigation, typing, keyboard opening/dismissal and instrumentation. SurfaceFlinger identifies Google SwiftShader software rendering. The bounded [release frame sample](android-release-frame-sample.json) is retained for review. These are different interaction windows, not a controlled before/after comparison. Smooth-performance sign-off remains open: profile representative physical devices and investigate any corresponding app-side bottleneck there.

Remaining verification and follow-up:

1. iOS on real notch/Dynamic Island devices: keyboard/presentation lifecycle, swipe back, safe areas, VoiceOver, Dynamic Type, Reduce Motion, floating/external keyboard and synchronized keyboard movement.
2. Android physical devices, older API levels, TalkBack spoken traversal, haptic feel, Bluetooth/audio interruptions, notification overlays and sustained playback/reconnect with a reachable service.
3. Native frame-by-frame Android IME synchronization: this implementation uses React Native's native IME-derived metrics and brief layout animation; it does not claim a custom `WindowInsetsAnimationCompat` implementation.
4. Full light-theme product work is outside the established dark-only visual identity; system light/dark checks do not constitute a light theme.
5. Rotation is locked by the current app configuration; responsive resized portrait configurations were tested instead. Tablet/split-screen/floating keyboard coverage remains open.
6. End-to-end provider auth, actual email delivery, reconnect under network interruption and server-confirmed requests remain unverified. The stale audit proxy that blocked the initial release checks has been removed; live metadata now loads successfully, and Android's native media session reached `PLAYING` with no playback error during the follow-up check.
7. Dense share-card exports retain their deliberately fixed format; extreme content and native share/save consumers need further hardware verification.

## Platform references

Inset behavior follows the distinction between system bars, safe areas and IME occlusion, rather than a guessed keyboard height. Android documents native IME visibility/inset and animation APIs in [Control and animate the software keyboard](https://developer.android.com/develop/ui/views/layout/sw-keyboard), and API 35+ edge-to-edge behavior in [Display content edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge). Apple describes adaptable layouts and safe areas in [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) and floating-keyboard considerations in [UIKeyboardLayoutGuide](https://developer.apple.com/documentation/uikit/uikeyboardlayoutguide). Apple motion and haptic guidance links were consulted, but their JavaScript-only pages did not expose full text to this tool; no unsupported quotations are used.
