import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { MusicRequest } from "@/core/domain/music-request";
import { User } from "@/core/domain/user";
import { DICT } from "@/i18n";
import { THEME } from "@/theme";
import { Avatar } from "@/components/Avatar";
import { Cover } from "@/components/Cover";
import { styles } from "@/components/RequestBottomSheet/styles";
import { haptics } from "@/utils/haptics";
import { Sheet } from "@/components/Sheet";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface Props {
  visible: boolean;
  track?: MusicRequest;
  user: User | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<{ success: boolean; message: string }>;
  onRequestSuccess: (trackId: string) => void;
}

function TrackSummary({ track }: { track: MusicRequest }) {
  return (
    <View style={styles.trackRow}>
      <Cover cover={track.artwork} style={styles.cover} category="search" />
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
  );
}

function RequesterRow({ user }: { user: User }) {
  return (
    <View style={styles.userRow}>
      <Avatar uri={user.avatarUrl} style={styles.avatar} />
      <Text style={styles.username}>{user.nickname || user.username}</Text>
    </View>
  );
}

function RequestStatus({
  success,
  message,
}: {
  success: boolean;
  message: string;
}) {
  return (
    <View style={styles.statusBox}>
      <MaterialIcons
        name={success ? "check-circle" : "error"}
        size={THEME.ICON.XL}
        color={success ? THEME.COLORS.BRAND : THEME.COLORS.ERROR}
      />
      <Text
        style={[
          styles.statusText,
          success ? styles.statusSuccess : styles.statusError,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function RequestActionButton({
  submitting,
  error,
  label,
  onPress,
}: {
  submitting: boolean;
  error: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: submitting, busy: submitting }}
      onPress={onPress}
      disabled={submitting}
      style={[
        styles.okButton,
        error && styles.okButtonError,
        submitting && styles.okButtonDisabled,
      ]}
    >
      {submitting ? (
        <ActivityIndicator color={THEME.COLORS.TEXT} />
      ) : (
        <Text style={styles.okText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
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
        haptics.success();
        setStatus("success");
        setStatusMessage(result.message);
        if (track) onRequestSuccess(track.id);
      } else {
        haptics.error();
        setStatus("error");
        setStatusMessage(result.message);
      }
    } catch {
      haptics.error();
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
        {track && <TrackSummary track={track} />}
        {user && <RequesterRow user={user} />}

        {isDone ? (
          <RequestStatus
            success={status === "success"}
            message={statusMessage}
          />
        ) : (
          <>
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{DICT[lang].INFO_REQUEST}</Text>
            </View>
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

        <RequestActionButton
          submitting={isSubmitting}
          error={status === "error"}
          label={isDone ? DICT[lang].OK_BUTTON : DICT[lang].SEND_REQUEST_BUTTON_TEXT}
          onPress={isDone ? onClose : handleSubmit}
        />
      </ScrollView>
    </Sheet>
  );
}
