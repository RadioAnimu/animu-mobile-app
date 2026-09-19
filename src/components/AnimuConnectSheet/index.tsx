import { useEffect, useState } from "react";
import type { AuthAccountEmail } from "animu-api";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { useEmailCodeFlow, emailCodeError } from "@/hooks/useEmailCodeFlow";
import { THEME } from "@/theme";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { Sheet } from "@/components/Sheet";
import { styles } from "@/components/AnimuConnectSheet/styles";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Screen = "list" | "form";

/** Manages the account's Animu Connect emails (provider + extra). */
export function AnimuConnectSheet({ visible, onClose }: Props) {
  const { emails, refreshEmails, requestAddEmail, verifyAddEmail, removeEmail } =
    useAuth();
  const { toast, error: showError } = useAlert();
  const dict = useDict();

  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("list");
  const [removing, setRemoving] = useState(false);

  const flow = useEmailCodeFlow({
    requestCode: requestAddEmail,
    verifyCode: verifyAddEmail,
    onCodeSent: () => toast(dict.LOGIN_CODE_SENT),
    onVerified: () => {
      toast(dict.ACCOUNT_EMAIL_SAVED);
      setScreen("list");
    },
    mapRequestError: (error) =>
      emailCodeError(dict, error, dict.ACCOUNT_ACTION_FAILED, {
        taken: dict.ACCOUNT_EMAIL_TAKEN,
      }),
    mapVerifyError: (error) =>
      emailCodeError(dict, error, dict.ACCOUNT_ACTION_FAILED, {
        taken: dict.ACCOUNT_EMAIL_TAKEN,
      }),
  });

  const busy = flow.busy || removing;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    flow.setError(null);
    void refreshEmails().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // There is at most ONE extra `animu` email — when it exists the action
  // replaces it rather than adding another.
  const extraEmail = emails.find((item) => item.source === "animu") ?? null;

  const reset = () => {
    flow.reset();
    setScreen("list");
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
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
              setRemoving(true);
              try {
                await removeEmail(target.id);
                toast(dict.ACCOUNT_EMAIL_REMOVED);
              } catch (err) {
                console.error("[AnimuConnectSheet] Remove email failed:", err);
                showError(dict.ACCOUNT_ACTION_FAILED);
              } finally {
                setRemoving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const title =
    screen === "list" ? dict.ACCOUNT_ANIMU_CONNECT : dict.ACCOUNT_EMAIL_ADD;

  return (
    <Sheet visible={visible} onClose={handleClose} withKeyboard closable={!busy}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {flow.step === "code"
            ? dict.LOGIN_CODE_SUBTITLE.replace("{email}", flow.email.trim())
            : dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT}
        </Text>

        {screen === "list" ? (
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

            {flow.error && <Text style={styles.error}>{flow.error}</Text>}

            {/*
              The server allows only ONE extra email and rejects a new add
              while it exists, so the action is hidden until the current one
              is removed (the row above carries the Remove button).
            */}
            {!extraEmail && (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={busy || loading}
                onPress={() => {
                  flow.reset();
                  setScreen("form");
                }}
                style={[
                  styles.submit,
                  (busy || loading) && styles.submitDisabled,
                ]}
              >
                <Text style={styles.submitText}>{dict.ACCOUNT_EMAIL_ADD}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <EmailCodeFields flow={flow} />

            {flow.error && <Text style={styles.error}>{flow.error}</Text>}

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={flow.busy}
              onPress={flow.step === "email" ? flow.sendCode : flow.verify}
              style={[styles.submit, flow.busy && styles.submitDisabled]}
            >
              {flow.busy ? (
                <ActivityIndicator color={THEME.COLORS.TEXT_ON_LIGHT} />
              ) : (
                <Text style={styles.submitText}>
                  {flow.step === "email"
                    ? dict.LOGIN_SEND_CODE
                    : dict.ACCOUNT_SAVE}
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
