/**
 * iOS oscilloscope stub.
 *
 * iOS cannot sample a live `AVPlayer` stream, so the visualizer is Android-only
 * for now. This renders nothing and deliberately imports nothing, keeping the
 * entire oscilloscope implementation out of the iOS bundle.
 */
export function Oscilloscope() {
  return null;
}
