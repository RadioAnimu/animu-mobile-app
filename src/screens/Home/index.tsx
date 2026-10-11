import { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import { ChooseBitrateSection } from "@/components/ChooseBitrateSection";
import { TrackCover } from "@/components/TrackCover";
import { HeaderBar } from "@/components/HeaderBar";
import { Listeners } from "@/components/Listeners";
import { Live } from "@/components/Live";
import { LiveRequestModal } from "@/components/LiveRequestModal";
import { Logo } from "@/components/Logo";
import { Oscilloscope } from "@/components/Oscilloscope";
import { PopUpProgram } from "@/components/PopUpProgram";
import { Program } from "@/components/Program";
import { TimeRemaining } from "@/components/TimeRemaining";

// Styles
import { styles } from "@/screens/Home/styles";
import { useRouteReselect } from "@/hooks/useRouteReselect";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import { THEME } from "@/theme";

export const Home = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLiveRequestModalVisible, setIsLiveRequestModalVisible] =
    useState(false);

  // Re-tapping the drawer's active item scrolls this page back to the top.
  const scrollRef = useRef<ScrollView | null>(null);
  useRouteReselect("Home", () =>
    scrollRef.current?.scrollTo({ y: 0, animated: true }),
  );

  const endPadding = useScrollEndPadding(THEME.SPACE.LG);

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

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Pinned above the scroll view: an overscroll pull must never drag
          the header down and expose the artwork behind the status bar. */}
      <HeaderBar openLiveRequestModal={() => handleLiveRequestModal(true)} />
      {/* Scrolls only when the player outgrows the screen (small phones,
          large text) — no rubber-band drag when everything already fits. */}
      <ScrollView ref={scrollRef} alwaysBounceVertical={false}>
        <View style={styles.containerApp}>
          <View style={styles.logoAndOscilloscope}>
            <Oscilloscope />
            <Logo size={THEME.LAYOUT.LOGO_HEIGHT} />
          </View>

          <View style={styles.listenersWrapper}>
            <Listeners />
          </View>

          <View style={styles.coverWrapper}>
            <TrackCover />
          </View>

          <View style={styles.timeRemainingWrapper}>
            <TimeRemaining />
          </View>

          <View style={styles.liveWrapper}>
            <Live />
          </View>

          <View style={styles.programWrapper}>
            <Program handleClick={handleOpenProgramModal} />
          </View>

          <ChooseBitrateSection />
        </View>
        {/* Clears the home indicator once scrolled to the end. */}
        <View style={{ height: endPadding }} />
      </ScrollView>

      <LiveRequestModal
        visible={isLiveRequestModalVisible}
        handleClose={() => handleLiveRequestModal(false)}
      />

      <PopUpProgram
        visible={isModalVisible}
        handleClose={handleCloseProgramModal}
      />
    </SafeAreaView>
  );
};
