import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from "react-native";

import { THEME } from "../../theme";
import { styles } from "./styles";

export interface SelectOption<T extends string> {
  key: T;
  label: string;
  /** Optional supporting line rendered under the label once expanded. */
  meta?: string;
  /** Optional leading preview (e.g. a cover sample) once expanded. */
  thumb?: ImageSourcePropType;
  /** Optional pill rendered next to the label once expanded. */
  badge?: string;
}

interface Props<T extends string> {
  label: string;
  /** Optional helper line under the label, like the other settings rows. */
  description?: string;
  options: SelectOption<T>[];
  value: T;
  /**
   * Applies the choice. When it returns a promise the list stays open,
   * blocking, until it resolves — the same "no settings leave the UI before
   * the storage work behind them is done" contract the old sheets had.
   */
  onChange: (key: T) => void | Promise<void>;
  disabled?: boolean;
}

/**
 * Inline dropdown: a plain settings row that unfolds its options in place,
 * as more rows of the same card. No modal, no portal. Options can carry a
 * preview thumbnail so a choice like cover quality reads at a glance.
 */
export function Select<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [applyingKey, setApplyingKey] = useState<T | null>(null);
  const applying = applyingKey != null;
  const expanded = open && !disabled;

  const selected = options.find((option) => option.key === value);

  const animate = () =>
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });

  const toggle = () => {
    animate();
    setOpen((current) => !current);
  };

  const choose = async (key: T) => {
    if (applying) return;
    // Re-pressing the current value mutates nothing — just fold the list.
    if (key === value) {
      animate();
      setOpen(false);
      return;
    }
    setApplyingKey(key);
    try {
      await onChange(key);
      animate();
      setOpen(false);
    } catch (error) {
      console.warn("[Select] change failed:", error);
    } finally {
      setApplyingKey(null);
    }
  };

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: disabled || undefined }}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={toggle}
        style={[styles.row, disabled && styles.disabled]}
      >
        <View style={styles.body}>
          <Text style={styles.label}>{label}</Text>
          {description != null && (
            <Text style={styles.description}>{description}</Text>
          )}
        </View>
        <View style={styles.value}>
          <Text style={styles.valueText} numberOfLines={1}>
            {selected?.label ?? ""}
          </Text>
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            const isSelected = option.key === value;
            const isApplying = option.key === applyingKey;
            return (
              <View key={option.key}>
                {index > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: isSelected,
                    disabled: applying || undefined,
                  }}
                  activeOpacity={0.7}
                  disabled={applying}
                  onPress={() => void choose(option.key)}
                  style={[
                    styles.option,
                    applying && !isApplying && styles.disabled,
                  ]}
                >
                  {option.thumb != null && (
                    <Image
                      source={option.thumb}
                      style={[
                        styles.optionThumb,
                        isSelected && styles.optionThumbSelected,
                      ]}
                    />
                  )}
                  <View style={styles.optionBody}>
                    <View style={styles.optionTitleRow}>
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.badge != null && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{option.badge}</Text>
                        </View>
                      )}
                    </View>
                    {option.meta != null && (
                      <Text style={styles.optionMeta} numberOfLines={2}>
                        {option.meta}
                      </Text>
                    )}
                  </View>
                  {isApplying ? (
                    <ActivityIndicator
                      size="small"
                      color={THEME.COLORS.TEXT_DIM}
                    />
                  ) : isSelected ? (
                    <MaterialIcons
                      name="check"
                      size={THEME.ICON.MD}
                      color={THEME.COLORS.BRAND}
                    />
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
