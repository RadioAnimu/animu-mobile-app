import { useEffect, useState } from "react";
import { AnimuApiError, type AuthAccountEmail } from "animu-api";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
}

type Mode = "list" | "add" | "verify";

/** Manages the account's Animu Connect emails (provider + extra). */
export function AnimuConnectSheet({ visible, onClose }: Props) {
  const { getEmails, requestAddEmail, verifyAddEmail, removeEmail } = useAuth();
  const { settings } = useUserSettings();
  const { toast, error: showError } = useAlert();
  const dict = DICT[settings.selectedLanguage];

  const [emails, setEmails] = useState<AuthAccountEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getEmails()
      .then((result) => {
        if (!cancelled) setEmails(result.emails);
      })
      .catch((err) => {
        console.error("[AnimuConnectSheet] Failed to load emails:", err);
        if (!cancelled) setError(dict.ACCOUNT_ACTION_FAILED);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reset = () => {
    setMode("list");
    setEmail("");
    setCode("");
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSendCode = async () => {
    if (busy) return;
    const address = email.trim();
    if (!address) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestAddEmail(address);
      setEmail(address);
      setMode("verify");
      toast(dict.LOGIN_CODE_SENT);
    } catch (err) {
      setError(
        err instanceof AnimuApiError && err.code === "email_taken"
          ? dict.ACCOUNT_EMAIL_TAKEN
          : dict.ACCOUNT_ACTION_FAILED,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (busy) return;
    const value = code.trim();
    if (!value) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await verifyAddEmail(email.trim(), value);
      setEmails(result.emails);
      toast(dict.ACCOUNT_EMAIL_SAVED);
      reset();
    } catch (err) {
      setError(
        err instanceof AnimuApiError && err.code === "email_code_failed"
          ? dict.LOGIN_CODE_INVALID
          : err instanceof AnimuApiError && err.code === "email_taken"
            ? dict.ACCOUNT_EMAIL_TAKEN
            : dict.ACCOUNT_ACTION_FAILED,
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (target: AuthAccountEmail) => {
    Alert.alert(
      dict.ACCOUNT_EMAIL_REMOVE_CONFIRM_TITLE,
      dict.ACCOUNT_EMAIL_REMOVE_CONFIRM_MSG.replace("{email}", target.email),
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.ACCOUNT_EMAIL_REMOVE,
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await removeEmail(target.id);
                setEmails(result.emails);
                toast(dict.ACCOUNT_EMAIL_REMOVED);
              } catch (err) {
                console.error("[AnimuConnectSheet] Remove email failed:", err);
                showError(dict.ACCOUNT_ACTION_FAILED);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const title =
    mode === "list" ? dict.ACCOUNT_ANIMU_CONNECT : dict.ACCOUNT_EMAIL_ADD;

  return (
    <Sheet visible={visible} onClose={handleClose} withKeyboard closable={!busy}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {mode === "verify"
            ? dict.LOGIN_CODE_SUBTITLE.replace("{email}", email.trim())
            : dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT}
        </Text>

        {mode === "list" ? (
          <>
            {loading ? (
              <ActivityIndicator
                color={THEME.COLORS.TEXT}
                style={styles.loading}
              />
            ) : (
              <View style={styles.list}>
                {emails.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowEmail}>{item.email}</Text>
                      <View style={styles.rowMeta}>
                        <Text style={styles.badge}>
                          {item.source === "animu"
                            ? dict.ACCOUNT_ANIMU_CONNECT
                            : item.provider || dict.ACCOUNT_EMAIL_PROVIDER}
                        </Text>
                        <Text
                          style={[
                            styles.badge,
                            item.verified
                              ? styles.badgeVerified
                              : styles.badgePending,
                          ]}
                        >
                          {item.verified
                            ? dict.ACCOUNT_EMAIL_VERIFIED
                            : dict.ACCOUNT_EMAIL_NOT_VERIFIED}
                        </Text>
                      </View>
                    </View>
                    {item.removable && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={dict.ACCOUNT_EMAIL_REMOVE}
                        activeOpacity={0.7}
                        disabled={busy}
                        onPress={() => confirmRemove(item)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeText}>
                          {dict.ACCOUNT_EMAIL_REMOVE}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {emails.length === 0 && (
                  <Text style={styles.empty}>{dict.ACCOUNT_EMAIL_EMPTY}</Text>
                )}
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={busy || loading}
              onPress={() => {
                setError(null);
                setMode("add");
              }}
              style={[styles.submit, (busy || loading) && styles.submitDisabled]}
            >
              <Text style={styles.submitText}>{dict.ACCOUNT_EMAIL_ADD}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {mode === "add" && (
              <>
                <Text style={styles.fieldLabel}>{dict.LOGIN_EMAIL}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder={dict.LOGIN_EMAIL_PLACEHOLDER}
                  placeholderTextColor={THEME.COLORS.TEXT_DIM}
                  onSubmitEditing={handleSendCode}
                />
              </>
            )}

            {mode === "verify" && (
              <>
                <Text style={styles.fieldLabel}>{dict.LOGIN_CODE}</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={6}
                  editable={!busy}
                  placeholder={dict.LOGIN_CODE_PLACEHOLDER}
                  placeholderTextColor={THEME.COLORS.TEXT_DIM}
                  onSubmitEditing={handleVerify}
                />
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={busy}
              onPress={mode === "add" ? handleSendCode : handleVerify}
              style={[styles.submit, busy && styles.submitDisabled]}
            >
              {busy ? (
                <ActivityIndicator color={THEME.COLORS.TEXT_ON_LIGHT} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "add" ? dict.LOGIN_SEND_CODE : dict.ACCOUNT_SAVE}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={busy}
              onPress={reset}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>{dict.ACCOUNT_CANCEL}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
