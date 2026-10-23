import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChooseBitrateSection } from "@/components/ChooseBitrateSection";
import { Listeners } from "@/components/Listeners";
import { Live } from "@/components/Live";
import { Logo } from "@/components/Logo";
import { Oscilloscope } from "@/components/Oscilloscope";
import { Program } from "@/components/Program";
import { TimeRemaining } from "@/components/TimeRemaining";
import { TrackCover } from "@/components/TrackCover";
import { ProgramBanner } from "@/screens/Home/ProgramBanner";
import type { SplitMetrics } from "@/screens/Home/metrics";
import { splitStyles as styles } from "@/screens/Home/styles";

interface Props {
  metrics: SplitMetrics;
  handleOpenProgram: () => void;
}

/**
 * The player for a wide window (landscape phone, tablet, TV), laid out like
 * the website's home: the on-air program on the left (logo and scope, the
 * banner when there is height for it, program, bitrate) and the artwork column
 * on the right (listeners badge, cover, countdown), with the song ticker
 * running full-bleed under both. The same components as the stacked player,
 * rearranged — audio lives in the PlayerProvider, so switching between the two
 * compositions on rotation only remounts what is drawn.
 */
export function SplitBody({ metrics, handleOpenProgram }: Readonly<Props>) {
  const { infoWidth, artWidth, gap } = metrics;
  // The panes center within the safe area (a landscape notch or camera
  // cutout may sit on one side only); the ticker below runs full-bleed.
  const { left, right } = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.panes,
          { width: metrics.contentWidth + left + right, paddingLeft: left, paddingRight: right },
        ]}
      >
        <View style={[styles.pane, { width: infoWidth }]}>
          <View style={styles.pane}>
            <Oscilloscope width={infoWidth} height={metrics.logoHeight} />
            <Logo size={metrics.logoHeight} />
          </View>

          {metrics.bannerWidth !== null && (
            <View style={{ marginTop: gap }}>
              <ProgramBanner
                width={metrics.bannerWidth}
                handleClick={handleOpenProgram}
              />
            </View>
          )}

          <View style={[styles.programWrapper, { marginTop: gap }]}>
            <Program handleClick={handleOpenProgram} />
          </View>

          <ChooseBitrateSection />
        </View>

        <View style={[styles.pane, { width: artWidth }]}>
          <View style={{ marginBottom: metrics.listenersGap }}>
            <Listeners />
          </View>

          <View style={{ marginBottom: metrics.coverGap }}>
            <TrackCover size={metrics.coverSize} />
          </View>

          <View style={styles.timeRemainingWrapper}>
            <TimeRemaining />
          </View>
        </View>
      </View>

      <View style={styles.liveWrapper}>
        <Live />
      </View>
    </View>
  );
}
