/**
 * Track types and station logic come from the `animu-api` package — the
 * package's mappers own the parsing (rawtitle, filler filtering, progress
 * math), so the app never re-implements station rules.
 *
 * This file stays as the app-side import path so call sites keep reading
 * `core/domain/track` (thin re-export, no logic here).
 */
export type { Track, Artworks } from "animu-api";
export { getTrackProgress, isRealTrack } from "animu-api";
