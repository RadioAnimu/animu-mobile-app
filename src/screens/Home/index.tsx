import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { HeaderBar } from "@/components/HeaderBar";
import { LiveRequestModal } from "@/components/LiveRequestModal";
import { PopUpProgram } from "@/components/PopUpProgram";

// Styles
import { SplitBody } from "@/screens/Home/SplitBody";
import { StackedBody } from "@/screens/Home/StackedBody";
import {
  headerHeight,
  resolveSplitMetrics,
  resolveStackedCover,
  splitContentWidth,
} from "@/screens/Home/metrics";
import { centeredContent, styles } from "@/screens/Home/styles";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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

  const layout = useResponsiveLayout();
  const { split, short } = layout;
  // A landscape phone has no height to spare: only the home indicator is cleared.
  const endPadding = useScrollEndPadding(
    split && short ? THEME.SPACE.SM : THEME.SPACE.LG,
  );

  // Sizes for the two-pane player; the stack needs none.
  const topInset = useSafeAreaInsets().top;
  const splitMetrics = useMemo(
    () => (split ? resolveSplitMetrics(layout, headerHeight(topInset), endPadding) : null),
    [split, layout, topInset, endPadding],
  );
  const stackedCover = useMemo(
    () => (split ? null : resolveStackedCover(layout, headerHeight(topInset), endPadding)),
    [split, layout, topInset, endPadding],
  );

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
    // No side edges here: the header bar and the song ticker paint
    // full-bleed under a landscape notch / camera cutout and inset their own
    // content, like the header already does under the status bar.
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Pinned above the scroll view: an overscroll pull must never drag
          the header down and expose the artwork behind the status bar. */}
      <HeaderBar
        openLiveRequestModal={() => handleLiveRequestModal(true)}
        rowWidth={split ? splitContentWidth(layout.usableWidth) : undefined}
      />
      {/* Scrolls only when the player outgrows the screen (small phones,
          large text) — no rubber-band drag when everything already fits.
          Where the window has room to spare, the player sits in the middle
          of it: a tablet's tall portrait window and every two-pane window.
          A phone in portrait keeps its stack at the top, as designed. */}
      <ScrollView
        ref={scrollRef}
        alwaysBounceVertical={false}
        contentContainerStyle={
          split || layout.windowClass !== "compact" ? centeredContent : undefined
        }
      >
        {splitMetrics ? (
          <SplitBody metrics={splitMetrics} handleOpenProgram={handleOpenProgramModal} />
        ) : (
          <StackedBody handleOpenProgram={handleOpenProgramModal} coverSize={stackedCover} />
        )}
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
