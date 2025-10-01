import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
} from "react-native-track-player";
import { THEME } from "../../theme";

export const DefaultRepeatMode = RepeatMode.Queue;
export const DefaultAudioServiceBehaviour =
  AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification;

const setupPlayer = async (
  options: Parameters<typeof TrackPlayer.setupPlayer>[0]
) => {
  const setup = async () => {
    try {
      await TrackPlayer.setupPlayer(options);
      return null;
    } catch (error) {
      return (error as Error & { code?: string }).code;
    }
  };

  let result = await setup();
  while (result === "android_cannot_setup_player_in_background") {
    console.log(
      "[SetupService] Waiting for background setup to be available..."
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    result = await setup();
  }

  if (result) {
    throw new Error(`Failed to setup player: ${result}`);
  }
};

export const SetupService = async () => {
  console.log("[SetupService] Setting up TrackPlayer...");

  try {
    await setupPlayer({
      autoHandleInterruptions: true,
    });

    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: DefaultAudioServiceBehaviour,
        alwaysPauseOnInterruption: true,
      },
      capabilities: [Capability.Play, Capability.Pause],
      compactCapabilities: [Capability.Play, Capability.Pause],
      notificationCapabilities: [Capability.Play, Capability.Pause],
      color: parseInt(THEME.COLORS.BACKGROUND_800.replace("#", ""), 16),
      progressUpdateEventInterval: 1,
    });

    console.log("[SetupService] TrackPlayer setup completed successfully");
  } catch (error) {
    console.error("[SetupService] TrackPlayer setup failed:", error);
    throw error;
  }
};
