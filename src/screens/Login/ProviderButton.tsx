import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { ProviderIcon } from "@/components/ProviderIcon";
import { THEME } from "@/theme";
import { styles } from "@/screens/Login/styles";

interface Props {
  /** Provider key for the brand mark (`"animu"` for Animu Connect). */
  provider: string;
  label: string;
  /** Second line in the brand hue; also outlines the pill in it. */
  perk?: string;
  /** This pill's sign-in is in flight: its mark becomes a spinner. */
  busy?: boolean;
  /** Another sign-in is running, so every pill locks. */
  disabled?: boolean;
  onPress: () => void;
}

/**
 * One outlined sign-in pill: mark left, centered label, an empty slot on the
 * right to balance the mark. The optional perk is what sets a pill apart —
 * the outline and a second line, never a fill.
 */
export function ProviderButton({
  provider,
  label,
  perk,
  busy = false,
  disabled = false,
  onPress,
}: Readonly<Props>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      // The perk is part of what the button promises, so it is read with it.
      accessibilityLabel={perk ? `${label}, ${perk}` : label}
      accessibilityState={{ busy, disabled }}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.method,
        !!perk && styles.methodEmphasis,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.methodIcon}>
        {busy ? (
          <ActivityIndicator color={THEME.COLORS.TEXT} />
        ) : (
          <ProviderIcon
            provider={provider}
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT}
          />
        )}
      </View>
      <View style={styles.methodText}>
        <Text style={styles.methodLabel}>{label}</Text>
        {!!perk && <Text style={styles.methodPerk}>{perk}</Text>}
      </View>
      <View style={styles.methodIcon} />
    </TouchableOpacity>
  );
}
