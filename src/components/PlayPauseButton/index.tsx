import { useRef, useState } from "react";
import { Image, type ImageStyle } from "expo-image";
import { type StyleProp, TouchableOpacity } from "react-native";
// Named for the ACTION they afford, not the glyph: the square (pause bars)
// renders while PLAYING, the triangle renders while PAUSED. The file names
// ("play_square_btn" / "play_triangle_btn") describe the paused/play button
// pair, which reads backwards at the call site otherwise.
import pauseAffordanceImage from "@/assets/play_square_btn.webp";
import playAffordanceImage from "@/assets/play_triangle_btn.webp";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

type Status = "playing" | "paused" | "changing";

interface Props {
  /** Size and placement of the glyph (the header's, the lyrics panel's). */
  style: StyleProp<ImageStyle>;
  /** TV: the control the D-pad starts on. */
  hasTVPreferredFocus?: boolean;
}

/**
 * The player's play / pause toggle — the header's centerpiece, reused by the
 * lyrics side panel. Its own component: the re-entrancy guard and the
 * optimistic status are its business alone, not its host's.
 */
export function PlayPauseButton({ style, hasTVPreferredFocus }: Readonly<Props>) {
  const dict = useDict();
  const player = usePlayer();
  const [status, setStatus] = useState<Status>("playing");
  /** Re-entrancy guard: two taps in one frame must not toggle twice. */
  const changingRef = useRef(false);

  return (
    <TouchableOpacity
      activeOpacity={THEME.OPACITY.PRESSED}
      accessibilityRole="button"
      accessibilityLabel={
        player.isPlaying ? dict.A11Y_PAUSE : dict.A11Y_PLAY
      }
      // "busy", not "disabled", while the toggle is in flight: on Android a
      // disabled accessibility state disables the native view, which drops
      // D-pad focus (TV, keyboards) the moment playback starts. The
      // re-entrancy guard above is what actually blocks a second press.
      accessibilityState={{ busy: status === "changing" }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={async () => {
        if (changingRef.current) return;
        changingRef.current = true;
        setStatus("changing");
        haptics.tap();
        // Capture the pre-toggle truth: after the await the render
        // closure's `player.isPlaying` is stale (the store moved, this
        // render did not), so re-reading it would report the WRONG
        // state. On failure revert to that same truth; the provider
        // already logs, the catch is the defensive backstop.
        const wasPlaying = player.isPlaying;
        try {
          if (wasPlaying) {
            await player.pause();
          } else {
            await player.play();
          }
          setStatus(wasPlaying ? "paused" : "playing");
        } catch (error) {
          console.warn("[PlayPauseButton] play/pause failed:", error);
          setStatus(wasPlaying ? "playing" : "paused");
        } finally {
          changingRef.current = false;
        }
      }}
    >
      <Image
        contentFit="contain"
        style={[
          style,
          {
            opacity: status === "changing" ? THEME.OPACITY.DISABLED : 1,
          },
        ]}
        source={!player.isPlaying ? playAffordanceImage : pauseAffordanceImage}
      />
    </TouchableOpacity>
  );
}
