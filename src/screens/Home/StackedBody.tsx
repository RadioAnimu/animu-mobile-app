import { View } from "react-native";
import { ChooseBitrateSection } from "@/components/ChooseBitrateSection";
import { Listeners } from "@/components/Listeners";
import { Live } from "@/components/Live";
import { Logo } from "@/components/Logo";
import { Oscilloscope } from "@/components/Oscilloscope";
import { Program } from "@/components/Program";
import { TimeRemaining } from "@/components/TimeRemaining";
import { TrackCover } from "@/components/TrackCover";
import { styles } from "@/screens/Home/styles";
import { THEME } from "@/theme";

interface Props {
  handleOpenProgram: () => void;
  /** A larger cover for a tablet-width window; omitted on phones. */
  coverSize?: number | null;
}

/**
 * The player as a single column — the layout the app was drawn for: a phone
 * in portrait, a tablet's tall window, an iPad split-view half.
 */
export function StackedBody({ handleOpenProgram, coverSize }: Readonly<Props>) {
  return (
    <View style={styles.containerApp}>
      <View style={styles.logoAndOscilloscope}>
        <Oscilloscope />
        <Logo size={THEME.LAYOUT.LOGO_HEIGHT} />
      </View>

      <View style={styles.listenersWrapper}>
        <Listeners />
      </View>

      <View style={styles.coverWrapper}>
        <TrackCover size={coverSize ?? undefined} />
      </View>

      <View style={styles.timeRemainingWrapper}>
        <TimeRemaining />
      </View>

      <View style={styles.liveWrapper}>
        <Live />
      </View>

      <View style={styles.programWrapper}>
        <Program handleClick={handleOpenProgram} />
      </View>

      <ChooseBitrateSection />
    </View>
  );
}
