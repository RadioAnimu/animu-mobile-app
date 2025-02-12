import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { DiscordUser, UserContext } from "../../contexts/user.context";
import { DICT } from "../../languages";
import { RootStackParamList } from "../../routes/app.routes";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { checkIfUserIsStillInTheServerAndIfYesExtendSession } from "../../components/CustomDrawer";

// Styles
import { styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const USER_DATA_KEY = "user";
const BACKGROUND_REFRESH_INTERVAL = 5000;
const TRACK_PROGRESS_INTERVAL = 1000;

export const Home = ({ navigation }: Props) => {
  const player = usePlayer();
  const userContext = useContext(UserContext);
  const { settings } = useUserSettings();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLiveRequestModalVisible, setIsLiveRequestModalVisible] =
    useState(false);
  const userRefPHPSESSID = useRef<DiscordUser | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // User data management
  const handleUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      if (!userData) {
        return;
      }

      const user = JSON.parse(userData);
      userContext?.setUser(user);
    } catch (error) {
      console.error("[Home] Error loading user data:", error);
    }
  }, [userContext]);

  // Background data refresh
  const refreshData = useCallback(async () => {
    console.log("[Home] Refreshing data...");
    try {
      await player.refreshData();

      if (userRefPHPSESSID.current && userContext?.user) {
        const isUserValid =
          await checkIfUserIsStillInTheServerAndIfYesExtendSession(
            userContext.user
          );
        if (!isUserValid) {
          await AsyncStorage.removeItem(USER_DATA_KEY);
          userContext.setUser(null);
        }
      }
    } catch (error) {
      console.error("[Home] Error refreshing data:", error);
    }
  }, [player, userContext]);

  // Track progress updates
  const startProgressUpdates = useCallback(() => {
    progressIntervalRef.current = setInterval(() => {
      player.updateCurrentTrackProgress();
    }, TRACK_PROGRESS_INTERVAL);
  }, [player]);

  // Effects
  useEffect(() => {
    handleUserData();
    refreshData();
    startProgressUpdates();

    // Setup background refresh
    BackgroundTimer.runBackgroundTimer(
      refreshData,
      BACKGROUND_REFRESH_INTERVAL
    );

    return () => {
      BackgroundTimer.stopBackgroundTimer();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    userRefPHPSESSID.current = userContext?.user || null;
  }, [userContext?.user]);

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
