import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import type { EmailCodeStep } from "@/hooks/useEmailCodeFlow";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { interpolate } from "@/utils/format";

const STEPS: readonly EmailCodeStep[] = ["email", "code"];

/**
 * "Step 1 of 2 · Enter email" over two progress segments. The code step is
 * the second half of the same sign-in, not a new screen, and this strip is
 * what says so: it stays put while only the form body below it changes.
 * The segments are decoration (the label already says where the user is), so
 * they are hidden from assistive tech and never respond to touch.
 */
export function EmailCodeStepIndicator({
  step,
  style,
}: Readonly<{
  step: EmailCodeStep;
  style?: StyleProp<ViewStyle>;
}>) {
  const dict = useDict();
  const current = STEPS.indexOf(step);

  return (
    <View style={style}>
      <Text style={styles.label}>
        {interpolate(dict.EMAIL_CODE_STEP, {
          step: current + 1,
          total: STEPS.length,
          label:
            step === "code"
              ? dict.EMAIL_CODE_STEP_CODE
              : dict.EMAIL_CODE_STEP_EMAIL,
        })}
      </Text>
      <View
        style={styles.segments}
        pointerEvents="none"
        aria-hidden
      >
        {STEPS.map((name, index) => (
          <View
            key={name}
            testID={`step-segment-${name}`}
            // The current and finished steps are lit; the upcoming one dim.
            style={[styles.segment, index <= current && styles.segmentReached]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
  },
  segments: {
    flexDirection: "row",
    gap: THEME.SPACE.XS,
    marginTop: THEME.SPACE.SM,
  },
  segment: {
    flex: 1,
    height: THEME.SPACE.XS,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.HAIRLINE,
  },
  segmentReached: {
    backgroundColor: THEME.COLORS.BRAND,
  },
});
