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
import { PlaybackStatus } from "@/screens/Home/PlaybackStatus";
import { TimeRemaining } from "@/components/TimeRemaining";

// Styles
import { styles } from "@/screens/Home/styles";
import { useRouteReselect } from "@/hooks/useRouteReselect";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import { THEME } from "@/theme";

export const Home = () => {
  const [sheet, setSheet] = useState<"program" | "live" | null>(null);

  // Re-tapping the drawer's active item scrolls this page back to the top.
  const scrollRef = useRef<ScrollView | null>(null);
  useRouteReselect("Home", () =>
    scrollRef.current?.scrollTo({ y: 0, animated: true }),
  );

  const endPadding = useScrollEndPadding(THEME.SPACE.LG);

  // UI Handlers
  const handleOpenProgramModal = useCallback(() => {
    setSheet("program");
  }, []);

  const handleCloseProgramModal = useCallback(() => {
    setSheet(null);
  }, []);

  const handleLiveRequestModal = useCallback((state: boolean) => {
    setSheet(state ? "live" : null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Pinned above the scroll view: an overscroll pull must never drag
          the header down and expose the artwork behind the status bar. */}
      <HeaderBar openLiveRequestModal={() => handleLiveRequestModal(true)} />
      <ScrollView ref={scrollRef} bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="never">
        <View style={styles.containerApp}>
          <View style={styles.logoAndOscilloscope}>
            <Oscilloscope />
            <Logo size={THEME.LAYOUT.LOGO_HEIGHT} />
          </View>

          <PlaybackStatus />

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
        visible={sheet === "live"}
        handleClose={() => handleLiveRequestModal(false)}
      />

      <PopUpProgram
        visible={sheet === "program"}
        handleClose={handleCloseProgramModal}
      />
    </SafeAreaView>
  );
};
