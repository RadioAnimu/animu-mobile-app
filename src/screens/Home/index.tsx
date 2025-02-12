import React, { useEffect, useRef, useState, useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackgroundTimer from "react-native-background-timer";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

// Components
import { Background } from "../../components/Background";
import { ChooseBitrateSection } from "../../components/ChooseBitrateSection";
import { CountdownTimerText } from "../../components/CountdownTimerText";
import { Cover } from "../../components/Cover";
import { HeaderBar } from "../../components/HeaderBar";
import { Listeners } from "../../components/Listeners";
import { Live } from "../../components/Live";
import { Logo } from "../../components/Logo";
import { Program } from "../../components/Program";
import { LiveRequestModal } from "../../components/LiveRequestModal";
import { PopUpProgram } from "../../components/PopUpProgram";

// Contexts and Utilities
import { DICT } from "../../languages";
import { RootStackParamList } from "../../routes/app.routes";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";

// Styles
import { styles } from "./styles";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { authService } from "../../core/services/auth.service";
import { backgroundService } from "../../core/services/background.service";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const BACKGROUND_REFRESH_INTERVAL = 5000;
const TRACK_PROGRESS_INTERVAL = 1000;

export const Home = ({ navigation }: Props) => {
  const player = usePlayer();
  const { user, logout } = useAuth();
  const { settings } = useUserSettings();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLiveRequestModalVisible, setIsLiveRequestModalVisible] =
    useState(false);

  // Background data refresh
  const refreshData = useCallback(async () => {
    try {
      await player.refreshData();
      await authService.initialize();

      if (user?.sessionId) {
        const isUserValid = await authService.validateSession();
        if (!isUserValid) {
          await logout();
        }
      }
    } catch (error) {
      console.error("[Home] Error refreshing data:", error);
    }
  }, [player, user]);

  // Effects
  useEffect(() => {
    // Initial data fetch
    refreshData();
    player.updateCurrentTrackProgress();

    // Start background tasks
    backgroundService.startTask({
      id: "refresh-data",
      callback: refreshData,
      interval: BACKGROUND_REFRESH_INTERVAL,
      backgroundTimer: true,
    });

    backgroundService.startTask({
      id: "track-progress",
      callback: player.updateCurrentTrackProgress,
      interval: TRACK_PROGRESS_INTERVAL,
      backgroundTimer: false,
    });

    // Cleanup
    return () => {
      backgroundService.stopTask("refresh-data");
      backgroundService.stopTask("track-progress");
    };
  }, []);

  // UI Handlers
  const handleOpenProgramModal = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const handleCloseProgramModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const handleLiveRequestModal = useCallback((state: boolean) => {
    setIsLiveRequestModalVisible(state);
  }, []);

  // Derived render values
  const shouldShowTimeLeft =
    !player.currentProgram?.isLive &&
    !player.currentTrack?.anime?.toLowerCase().includes("passagem");

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <HeaderBar
            openLiveRequestModal={() => handleLiveRequestModal(true)}
            navigation={navigation}
            currentTrack={player.currentTrack}
            currentProgram={player.currentProgram}
          />

          <View style={styles.containerApp}>
            <Logo size={127} />

            {player.currentListeners && player.currentTrack && (
              <Listeners
                props={{
                  listeners: player.currentListeners,
                  track: player.currentTrack,
                  program: player.currentProgram,
                }}
              />
            )}

            {player.currentTrack?.artwork && (
              <Cover cover={player.currentTrack.artwork} />
            )}

            {shouldShowTimeLeft && (
              <Text style={styles.timeLeft}>
                {DICT[settings.selectedLanguage].TIME_REMAINING}:{" "}
                <CountdownTimerText
                  startTime={
                    (player.currentTrack?.duration || 0) -
                    (player.currentTrack?.progress || 0)
                  }
                />
              </Text>
            )}

            {player.currentTrack && <Live track={player.currentTrack} />}

            {player.currentProgram && (
              <Program
                program={player.currentProgram}
                handleClick={handleOpenProgramModal}
              />
            )}

            <ChooseBitrateSection />
          </View>
        </ScrollView>

        <LiveRequestModal
          visible={isLiveRequestModalVisible}
          handleClose={() => handleLiveRequestModal(false)}
        />

        {player.currentStream?.category !== "REPRISES" &&
          player.currentProgram && (
            <PopUpProgram
              visible={isModalVisible}
              _program={player.currentProgram}
              handleClose={handleCloseProgramModal}
            />
          )}
      </SafeAreaView>
    </Background>
  );
};
