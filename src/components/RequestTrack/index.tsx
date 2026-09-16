import React, { createContext, useContext } from "react";
import { Text, TouchableOpacity } from "react-native";
import { styles } from "./styles";
import { THEME } from "../../theme";
import { Cover } from "../Cover";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { MusicRequest } from "../../core/domain/music-request";

/**
 * Per-row action context. Lets the row fire its parent's stable handler
 * without the list item passing a fresh closure per row — every memoized
 * row then survives a `results` re-render untouched (only rows whose
 * item identity actually changed re-render).
 */
export const TrackRequestContext = createContext<(track: MusicRequest) => void>(
  () => {},
);

interface Props {
  track: MusicRequest;
}

export const RequestTrack = React.memo(function RequestTrack({ track }: Props) {
  const { settings } = useUserSettings();
  const onTrackRequest = useContext(TrackRequestContext);

  return (
    <TouchableOpacity
      onPress={() => onTrackRequest(track)}
      style={[
        styles.container,
        {
          backgroundColor: track.requestable
            ? THEME.COLORS.ROW_ACTIVE
            : THEME.COLORS.ROW_INACTIVE,
        },
      ]}
    >
      {settings.coversInRequestSearch && (
        // recyclingKey lets expo-image recycle the native image view as
        // rows scroll — a 200-row search never keeps 200 decoders alive.
        <Cover
          cover={track.artwork}
          style={styles.image}
          recyclingKey={track.id}
        />
      )}
      {/* Fixed height: getItemLayout needs every row at the same height. */}
      <Text style={styles.text} numberOfLines={1}>
        {track.artist} | {track.raw}
      </Text>
    </TouchableOpacity>
  );
});
