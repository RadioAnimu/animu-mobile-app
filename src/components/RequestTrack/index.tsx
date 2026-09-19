import React, { useContext } from "react";
import { Text, TouchableOpacity } from "react-native";
import { styles } from "@/components/RequestTrack/styles";
import { TrackRequestContext } from "@/components/RequestTrack/context";
import { THEME } from "@/theme";
import { Cover } from "@/components/Cover";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { MusicRequest } from "@/core/domain/music-request";

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
          category="search"
        />
      )}
      {/* Wraps to as many lines as the title needs. */}
      <Text style={styles.text}>{track.artist} | {track.raw}</Text>
    </TouchableOpacity>
  );
});
