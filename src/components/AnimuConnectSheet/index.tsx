import { useState } from "react";
import { AnimuApiError } from "animu-api";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";

import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { Sheet } from "../Sheet";
import { styles } from "./styles";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** `true` when credentials already exist (current password required). */
  hasCredentials: boolean;
}

/** Mini-form for `auth.setCredentials` — set up or update Animu Connect. */
export function AnimuConnectSheet({
  visible,
  onClose,
  hasCredentials,
}: Props) {
  const { setCredentials } = useAuth();
  const { settings } = useUserSettings();
  const { toast } = useAlert();
  const dict = DICT[settings.selectedLanguage];

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (busy) return;
    setUsername("");
    setPassword("");
    setCurrentPassword("");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (!username.trim()) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    if (!hasCredentials && !password) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }

    // The server is the source of truth on whether a current password is
    // needed (we can't always know the setup state) — it replies
    // `credentials_failed` and we surface that below.
    if (hasCredentials && !currentPassword) {
      setError(dict.ACCOUNT_CURRENT_PASSWORD_REQUIRED);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await setCredentials({
        username: username.trim(),
        password: password || undefined,
        currentPassword: currentPassword || undefined,
      });
      toast(dict.ACCOUNT_CREDENTIALS_SAVED);
      handleClose();
    } catch (error) {
      setError(
        error instanceof AnimuApiError && error.code === "credentials_failed"
          ? dict.ACCOUNT_CREDENTIALS_FAILED
          : dict.ACCOUNT_ACTION_FAILED,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={handleClose} withKeyboard closable={!busy}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {hasCredentials
            ? dict.ACCOUNT_ANIMU_CONNECT_UPDATE
            : dict.ACCOUNT_ANIMU_CONNECT_SETUP}
        </Text>
        <Text style={styles.subtitle}>{dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT}</Text>

        <Text style={styles.fieldLabel}>{dict.LOGIN_USERNAME}</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholder={dict.LOGIN_USERNAME_PLACEHOLDER}
          placeholderTextColor={THEME.COLORS.TEXT_DIM}
        />

        <Text style={styles.fieldLabel}>
          {hasCredentials ? dict.ACCOUNT_NEW_PASSWORD : dict.LOGIN_PASSWORD}
        </Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
          placeholder={dict.LOGIN_PASSWORD_PLACEHOLDER}
          placeholderTextColor={THEME.COLORS.TEXT_DIM}
        />

        <Text style={styles.fieldLabel}>
          {dict.ACCOUNT_CURRENT_PASSWORD}
        </Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
          placeholder={dict.ACCOUNT_CURRENT_PASSWORD_PLACEHOLDER}
          placeholderTextColor={THEME.COLORS.TEXT_DIM}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={busy}
          onPress={handleSubmit}
          style={[styles.submit, busy && styles.submitDisabled]}
        >
          {busy ? (
            <ActivityIndicator color={THEME.COLORS.TEXT} />
          ) : (
            <Text style={styles.submitText}>{dict.ACCOUNT_SAVE}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Sheet>
  );
}
