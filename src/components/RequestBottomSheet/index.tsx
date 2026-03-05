import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { CONFIG } from "../../utils/player.config";
import DragIcon from "../../assets/icons/ArrastarParaBaixo.png";
import { styles } from "./styles";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface Props {
  visible: boolean;
  track?: MusicRequest;
  user: User | null;
  queueCount?: number;
  onClose: () => void;
  onSubmit: (message: string) => Promise<{ success: boolean; message: string }>;
  onRequestSuccess: (trackId: string) => void;
}

export function RequestBottomSheet({
  visible,
  track,
  user,
  queueCount,
  onClose,
  onSubmit,
  onRequestSuccess,
}: Props) {
  const { settings } = useUserSettings();
  const lang = settings.selectedLanguage;

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Reset form when modal opens with a new track
  useEffect(() => {
    if (visible) {
      setMessage("");
      setStatus("idle");
      setStatusMessage("");
    }
  }, [visible, track?.id]);

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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={isDone || !isSubmitting ? onClose : undefined}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        {/* Tap-outside only when not submitting */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={!isSubmitting ? onClose : undefined}
        />

        <View style={styles.sheet}>
          {/* Drag handle */}
          <TouchableOpacity
            style={styles.closeArea}
            onPress={!isSubmitting ? onClose : undefined}
          >
            <RNImage source={DragIcon} style={styles.dragIcon} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: 16,
              paddingHorizontal: 16,
              paddingBottom: 8,
            }}
          >
            {/* Track row */}
            {track && (
              <View style={styles.trackRow}>
                <Image
                  source={{ uri: track.artwork }}
                  style={styles.cover}
                  placeholder={{ uri: CONFIG.DEFAULT_COVER }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
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

            {/* Queue count + user */}
            {(queueCount !== undefined || user) && (
              <View style={styles.queueUserRow}>
                {queueCount !== undefined ? (
                  <View style={styles.queueRow}>
                    <Ionicons
                      name={queueCount === 0 ? "flash" : "musical-notes"}
                      size={14}
                      color={THEME.COLORS.CAPTION_500}
                    />
                    <Text style={styles.queueText}>
                      {queueCount === 0
                        ? "It will play next! 🎶"
                        : `${queueCount} song${queueCount !== 1 ? "s" : ""} in the request queue`}
                    </Text>
                  </View>
                ) : (
                  <View />
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
              </View>
            )}

            {/* Status feedback */}
            {isDone && (
              <View style={styles.statusBox}>
                {status === "success" ? (
                  <MaterialIcons
                    name="check-circle"
                    size={40}
                    color={THEME.COLORS.SHAPE}
                  />
                ) : (
                  <MaterialIcons
                    name="error"
                    size={40}
                    color={THEME.COLORS.ALERT}
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
                  placeholderTextColor={THEME.COLORS.TEXT}
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
                <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
              ) : (
                <Text style={styles.okText}>
                  {isDone ? "OK" : DICT[lang].SEND_REQUEST_BUTTON_TEXT}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
