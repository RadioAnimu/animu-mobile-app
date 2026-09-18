/**
 * iOS oscilloscope stub.
 *
 * iOS cannot tap the decoded stream of a live `AVPlayer` item (expo-audio's
 * `MTAudioProcessingTap` never invokes its render callback for indefinite
 * HTTP audio — verified natively), so there is no data feed for the
 * oscillocsope. This renders nothing and deliberately imports nothing from
 * the platform engine, keeping the entire oscilloscope implementation out
 * of the iOS bundle. The engine itself (`index.android.tsx`, shared with
 * Android) switches over unconditionally if/when an iOS feed lands.
 */
export function Oscilloscope() {
  return null;
}
