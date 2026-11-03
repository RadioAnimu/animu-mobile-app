import { View } from "react-native";
import { Listeners } from "@/components/Listeners";
import { Live } from "@/components/Live";
import { Program } from "@/components/Program";
import { TimeRemaining } from "@/components/TimeRemaining";
import { TrackCover } from "@/components/TrackCover";
import type { SplitMetrics } from "@/screens/Home/metrics";
import { ProgramArt } from "@/screens/Home/ProgramArt";
import { splitStyles as styles } from "@/screens/Home/styles";

interface Props {
  metrics: SplitMetrics;
  handleOpenProgram: () => void;
}

/**
 * The player for a landscape window, laid out as the website's hero: on the
 * left the program block — its art, and the program and DJ centered under
 * it — and on the right the cover block — listeners badge, cover, countdown;
 * under both the song ticker, full width. No logo: the oscilloscope runs
 * behind the header bar, as on the website's player, and no bitrate pills.
 * The same components as the stacked player, rearranged — audio
 * lives in the PlayerProvider, so switching compositions on rotation only
 * remounts what is drawn.
 */
export function SplitBody({ metrics, handleOpenProgram }: Readonly<Props>) {
  return (
    <View style={styles.page}>
      {/* The hero takes the height the strip leaves and sits centered in it;
          the NO AR strip stays at the bottom of the screen. */}
      <View style={styles.heroArea}>
        <View style={[styles.hero, { width: metrics.contentWidth }]}>
          <View style={styles.programColumn}>
            <ProgramArt width={metrics.artWidth} handleClick={handleOpenProgram} />
            <Program handleClick={handleOpenProgram} />
          </View>

          <View style={[styles.coverColumn, { width: metrics.coverColumnWidth }]}>
            <View style={styles.listenersWrapper}>
              <Listeners />
            </View>
            <View style={styles.coverWrapper}>
              <TrackCover size={metrics.coverSize} />
            </View>
            <View style={styles.timeRemainingWrapper}>
              <TimeRemaining />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.liveWrapper}>
        <Live />
      </View>
    </View>
  );
}
