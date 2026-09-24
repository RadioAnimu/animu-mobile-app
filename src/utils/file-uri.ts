/**
 * expo-image's Android impl returns Glide's `file.absolutePath` — a bare
 * filesystem path with no scheme. Consumers of these paths (media-session
 * artwork, expo-file-system `File`) require an absolute `file://` URI
 * ("URI is not absolute" otherwise), so normalize here while leaving
 * existing `file://` strings untouched.
 */
export function toFileUri(path: string): string {
  return /^file:\/\//.test(path) ? path : `file://${path}`;
}
