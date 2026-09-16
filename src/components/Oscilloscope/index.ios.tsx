/**
 * iOS entry — the same passthrough engine as Android.
 *
 * expo-audio 57 ships the AVPlayer sampling tap (`audioSampleUpdate`) on
 * iOS too, so the WebView canvas engine is fully cross-platform: the shared
 * WebAudio/canvas page, the hex bridge, rAF draw loop. Rendered nothing
 * only when the platform reports sampling unsupported (the React context
 * gates it through `visualizerSupported`).
 */
export { Oscilloscope } from "./index.android";
