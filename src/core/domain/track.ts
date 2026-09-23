/**
 * Track types and station logic come from the `animu-api` package — the
 * package's mappers own the parsing (rawtitle, filler filtering, progress
 * math), so the app never re-implements station rules.
 *
 * This file stays as the app-side import path so call sites keep reading
 * `core/domain/track` (thin re-export, no logic here).
 */
export type { Track } from "animu-api";
export { getTrackProgress, isRealTrack } from "animu-api";

/**
 * Station rule: "passagem" entries are filler beat transitions between
 * tracks, not actual music — progress/countdown UI must hide for them.
 * Single source of truth shared by HeaderBar and TimeRemaining.
 */
export function isFillerTransition(track: { anime?: string } | null | undefined): boolean {
  return track?.anime?.toLocaleLowerCase().includes("passagem") ?? false;
}
