import { ActivityIndicator } from "react-native";
import type { ComponentProps } from "react";

// Components
import { TrackRequestContext } from "@/components/RequestTrack/context";

// Core
import type { MusicRequest } from "@/core/domain/music-request";
import { THEME } from "@/theme";
import { RecentSearches } from "@/screens/MakeRequest/RecentSearches";
import { ResultsList } from "@/screens/MakeRequest/ResultsList";

/**
 * What fills the list area: recent searches, a spinner, the results, or —
 * mid-edit with nothing to suggest — nothing, so results for another query
 * never pass for this one.
 */
export function SearchBody({
  showRecent,
  editing,
  loading,
  onRequestTrack,
  recentProps,
  resultsProps,
}: Readonly<{
  showRecent: boolean;
  editing: boolean;
  loading: boolean;
  onRequestTrack: (track: MusicRequest) => void;
  recentProps: ComponentProps<typeof RecentSearches>;
  resultsProps: ComponentProps<typeof ResultsList>;
}>) {
  if (showRecent) {
    // Its own instance per mode: "Show all" starts collapsed again after a
    // round trip through the type-ahead.
    return (
      <RecentSearches
        key={recentProps.typed ? "matches" : "recent"}
        {...recentProps}
      />
    );
  }
  if (loading) return <ActivityIndicator color={THEME.COLORS.SPINNER} />;
  if (editing) return null;
  return (
    <TrackRequestContext.Provider value={onRequestTrack}>
      <ResultsList {...resultsProps} />
    </TrackRequestContext.Provider>
  );
}
