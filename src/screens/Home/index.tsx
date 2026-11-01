import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { HeaderBar } from "@/components/HeaderBar";
import { CONTAINER_HEIGHT } from "@/components/HeaderBar/styles";
import { Oscilloscope } from "@/components/Oscilloscope";
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
import { centeredContent, fillContent, styles } from "@/screens/Home/styles";
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
  // Rotating swaps the composition: the new one starts at its top, not at
  // the old one's scroll offset (which lands mid-hero).
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [split]);

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

  // Landscape fills the screen (the strip at the bottom, the hero centered
  // above it); a tablet's tall portrait window centers the stack; a
  // portrait phone keeps it at the top.
  const tallTablet = layout.windowClass !== "compact" ? centeredContent : undefined;
  const contentStyle = split ? fillContent : tallTablet;

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
        bar={split}
        // Landscape: the oscilloscope leaves the logo and runs behind the
        // bar, the website player's signature.
        backdrop={
          split ? <Oscilloscope width={layout.width} height={CONTAINER_HEIGHT} /> : undefined
        }
      />
      {/* Scrolls only when the player outgrows the screen (small phones,
          large text) — no rubber-band drag when everything already fits.
          Where the window has room to spare, the player sits in the middle
          of it: a tablet's tall portrait window and every two-pane window.
          A phone in portrait keeps its stack at the top, as designed. */}
      <ScrollView
        ref={scrollRef}
        alwaysBounceVertical={false}
        contentContainerStyle={contentStyle}
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
