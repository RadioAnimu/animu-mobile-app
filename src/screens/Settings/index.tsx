import { useEffect, useRef } from "react";import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect, SvgProps } from "react-native-svg";
import { Background } from "../../components/Background";
import { LoginComponent } from "../../components/CustomDrawer";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { styles, SWITCH } from "./styles";
import { DiscordProfile } from "../../components/DiscordProfile";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import type { ArtworkQuality } from "../../@types/artwork-quality";

export const BackArrow = (props: SvgProps) => (
  <Svg width="21" height="19" viewBox="0 0 21 19" fill="none">
    <Rect x="6" y="6" width="15" height="7" rx="2" fill="#ffffff" />
    <Path
      d="M-4.15258e-07 9.5L11.25 17.7272L11.25 1.27276L-4.15258e-07 9.5Z"
      fill="#ffffff"
    />
  </Svg>
);

interface TitleSectionProps {
  title: string;
}

export function TitleSection({ title }: TitleSectionProps) {
  return (
    <View style={styles.titleSection}>
      <Text style={styles.titleText}>{title}</Text>
    </View>
  );
}

function Splitter() {
  return <View style={styles.splitter} />;
}

interface SwitchProps {
  value: boolean;
}

function Switch({ value }: SwitchProps) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(position, {
      toValue: value ? 1 : 0,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [value, position]);

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [
      0,
      SWITCH.TRACK_WIDTH - SWITCH.THUMB - SWITCH.PADDING * 2,
    ],
  });

  return (
    <View
      style={[
        styles.switchTrack,
        {
          backgroundColor: value
            ? THEME.COLORS.SHAPE
            : "rgba(255, 255, 255, 0.25)",
        },
      ]}
    >
      <Animated.View
        style={[styles.switchThumb, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

interface SettingsRowProps {
  label: string;
  value: boolean;
  onToggle: () => void;
  isLast?: boolean;
}

function SettingsRow({ label, value, onToggle, isLast }: SettingsRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      activeOpacity={0.7}
      onPress={onToggle}
      style={[styles.row, isLast && styles.rowLast]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} />
    </TouchableOpacity>
  );
}

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            activeOpacity={0.7}
            onPress={() => {
              onChange(option.value);
            }}
            style={[styles.segment, selected && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function LanguageGrid() {
  const { settings, updateSettings } = useUserSettings();

  return (
    <View style={styles.langGrid}>
      {(Object.keys(LANGS_KEY_VALUE_PAIRS) as (keyof typeof LANGS_KEY_VALUE_PAIRS)[]).map(
        (languageKey) => {
          const selected = settings.selectedLanguage === languageKey;
          return (
            <TouchableOpacity
              key={languageKey}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              activeOpacity={0.7}
              onPress={() => {
                updateSettings({ selectedLanguage: languageKey });
                //! NEED TO REFRESH PLAYER
              }}
              style={[styles.langPill, selected && styles.langPillActive]}
            >
              <Text
                style={[
                  styles.langPillText,
                  selected && styles.langPillTextActive,
                ]}
              >
                {LANGS_KEY_VALUE_PAIRS[languageKey]}
              </Text>
            </TouchableOpacity>
          );
        },
      )}
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

const COVER_QUALITY_OPTIONS: { value: ArtworkQuality; label: string }[] = [
  { value: "high", label: "HIGH" },
  { value: "medium", label: "MEDIUM" },
  { value: "low", label: "LOW" },
];

export function Settings({ navigation }: Props) {
  const { settings, updateSettings } = useUserSettings();
  const { user, logout } = useAuth();

  const toggleLiveCovers = () => {
    updateSettings({
      liveQualityCover:
        settings.liveQualityCover === "off" ? "low" : "off",
    });
  };

  const qualityOptions = COVER_QUALITY_OPTIONS.map((option) => ({
    ...option,
    label: option.label === "HIGH"
      ? DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL_HIGH
      : option.label === "MEDIUM"
        ? DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL_MEDIUM
        : DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL_LOW,
  }));

  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              navigation.goBack();
            }}
            style={styles.headerButton}
          >
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.settingsText}>
            {DICT[settings.selectedLanguage].SETTINGS_TITLE}
          </Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={styles.appContainer}>
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_ACCOUNT_TITLE}
          />
          <View style={styles.card}>
            {user?.sessionId ? (
              <View style={styles.cardRow}>
                <View style={styles.profile}>
                  <DiscordProfile user={user} />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="logout"
                  onPress={async () => {
                    await logout();
                  }}
                  style={styles.iconButton}
                >
                  <MaterialIcons
                    name="logout"
                    size={22}
                    color={THEME.COLORS.WHITE_TEXT}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardRow}>
                <LoginComponent />
              </View>
            )}
          </View>

          <Splitter />
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_SAVE_DATA_TITLE}
          />
          <Text style={styles.sectionLabel}>
            {DICT[settings.selectedLanguage].SETTINGS_QUALITY_LIVE_LABEL}
          </Text>
          <SegmentedControl
            options={qualityOptions}
            value={settings.liveQualityCover}
            onChange={(value) => {
              updateSettings({ liveQualityCover: value });
            }}
          />
          <View style={styles.rowsGroup}>
            <SettingsRow
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_LIVE_LABEL_SWITCH
              }
              value={settings.liveQualityCover !== "off"}
              onToggle={toggleLiveCovers}
            />
            <SettingsRow
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_LAST_REQUESTED_SWITCH
              }
              value={settings.lastRequestedCovers}
              onToggle={() => {
                updateSettings({
                  lastRequestedCovers: !settings.lastRequestedCovers,
                });
              }}
            />
            <SettingsRow
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_LAST_PLAYED_SWITCH
              }
              value={settings.lastPlayedCovers}
              onToggle={() => {
                updateSettings({
                  lastPlayedCovers: !settings.lastPlayedCovers,
                });
              }}
            />
            <SettingsRow
              isLast
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_COVER_REQUESTED_SWITCH
              }
              value={settings.coversInRequestSearch}
              onToggle={() => {
                updateSettings({
                  coversInRequestSearch: !settings.coversInRequestSearch,
                });
              }}
            />
          </View>

          <Splitter />
          <TitleSection
            title={
              DICT[settings.selectedLanguage].SETTINGS_LANGUAGE_SELECT_TITLE
            }
          />
          <LanguageGrid />

          <Splitter />
          <TitleSection
            title={DICT[settings.selectedLanguage].SETTINGS_MEMORY_TITLE}
          />
          <View style={styles.rowsGroup}>
            <SettingsRow
              isLast
              label={
                DICT[settings.selectedLanguage]
                  .SETTINGS_MEMORY_CLEAR_CACHE_SWITCH
              }
              value={settings.cacheEnabled}
              onToggle={() => {
                updateSettings({
                  cacheEnabled: !settings.cacheEnabled,
                });
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
