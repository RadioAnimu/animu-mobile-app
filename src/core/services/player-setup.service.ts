import { setAudioModeAsync } from "expo-audio";
import { StartPlaybackSession } from "./player-playback.service";

export const SetupService = async () => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });

    // Start the system media session (lock screen / notification controls).
    // Must be called while the app is in the foreground.
    await StartPlaybackSession();
  } catch (error) {
    console.error("[SetupService] Audio setup failed:", error);
    throw error;
  }
};
