import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { MusicRequest } from "../../core/domain/music-request";
import { User } from "../../core/domain/user";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { Cover } from "../Cover";
import { styles } from "./styles";
import { Sheet } from "../Sheet";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface Props {
  visible: boolean;
  track?: MusicRequest;
  user: User | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<{ success: boolean; message: string }>;
  onRequestSuccess: (trackId: string) => void;
}

export function RequestBottomSheet({
  visible,
  track,
  user,
  onClose,
  onSubmit,
  onRequestSuccess,
}: Props) {
  const { settings } = useUserSettings();
  const lang = settings.selectedLanguage;

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Reset form when modal opens with a new track — "adjust state during
  // render" pattern (compiler-safe, no cascading effect render)
  const [prevOpenState, setPrevOpenState] = useState({
    visible,
    trackId: track?.id,
  });
  if (prevOpenState.visible !== visible || prevOpenState.trackId !== track?.id) {
    setPrevOpenState({ visible, trackId: track?.id });
    if (visible) {
      setMessage("");
      setStatus("idle");
      setStatusMessage("");
    }
  }

  const handleSubmit = async () => {
    if (status !== "idle") return;
    setStatus("submitting");
    try {
      const result = await onSubmit(message);
      if (result.success) {
        setStatus("success");
        setStatusMessage(result.message);
        if (track) onRequestSuccess(track.id);
      } else {
        setStatus("error");
        setStatusMessage(result.message);
      }
    } catch {
      setStatus("error");
      setStatusMessage(DICT[lang].REQUEST_ERROR);
    }
  };

  const isSubmitting = status === "submitting";
  const isDone = status === "success" || status === "error";

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      closable={!isSubmitting}
      withKeyboard
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
            {/* Track row */}
            {track && (
              <View style={styles.trackRow}>
                <Cover cover={track.artwork} style={styles.cover} />
                <View style={styles.trackInfo}>
                  <Text style={styles.songName} numberOfLines={2}>
                    {track.song}
                  </Text>
                  <Text style={styles.animeText} numberOfLines={1}>
                    {track.anime}
                  </Text>
                  <Text style={styles.artistText} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
              </View>
            )}

            {user && (
              <View style={styles.userRow}>
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                />
                <Text style={styles.username}>
                  {user.nickname || user.username}
                </Text>
              </View>
            )}

            {/* Status feedback */}
            {isDone && (
              <View style={styles.statusBox}>
                {status === "success" ? (
                  <MaterialIcons
                    name="check-circle"
                    size={THEME.ICON.XL}
                    color={THEME.COLORS.BRAND}
                  />
                ) : (
                  <MaterialIcons
                    name="error"
                    size={THEME.ICON.XL}
                    color={THEME.COLORS.ERROR}
                  />
                )}
                <Text
                  style={[
                    styles.statusText,
                    status === "success"
                      ? styles.statusSuccess
                      : styles.statusError,
                  ]}
                >
                  {statusMessage}
                </Text>
              </View>
            )}

            {/* Form — hidden once done */}
            {!isDone && (
              <>
                {/* Note */}
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>{DICT[lang].INFO_REQUEST}</Text>
                </View>

                {/* Message input */}
                <TextInput
                  style={[styles.input, isSubmitting && styles.inputDisabled]}
                  placeholder={DICT[lang].SEND_REQUEST_PLACEHOLDER}
                  placeholderTextColor={THEME.COLORS.TEXT_ON_LIGHT}
                  value={message}
                  onChangeText={setMessage}
                  editable={!isSubmitting}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />
              </>
            )}

            {/* Action button — always visible */}
            <TouchableOpacity
              onPress={isDone ? onClose : handleSubmit}
              disabled={isSubmitting}
              style={[
                styles.okButton,
                status === "error" && styles.okButtonError,
                isSubmitting && styles.okButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={THEME.COLORS.TEXT} />
              ) : (
                <Text style={styles.okText}>
                  {isDone ? DICT[lang].OK_BUTTON : DICT[lang].SEND_REQUEST_BUTTON_TEXT}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
    </Sheet>
  );
}
