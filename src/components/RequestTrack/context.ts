import { createContext } from "react";
import type { MusicRequest } from "@/core/domain/music-request";

/**
 * Per-row action context. Lets a row fire its parent's stable handler without
 * the list item passing a fresh closure per row — every memoized row then
 * survives a `results` re-render untouched (only rows whose item identity
 * actually changed re-render).
 */
export const TrackRequestContext = createContext<(track: MusicRequest) => void>(
  () => {},
);
