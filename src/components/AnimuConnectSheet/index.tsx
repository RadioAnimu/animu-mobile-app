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
import {
  useEmailCodeFlow,
  emailCodeError,
  type EmailCodeFlow,
} from "@/hooks/useEmailCodeFlow";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { Sheet } from "@/components/Sheet";
import { styles } from "@/components/AnimuConnectSheet/styles";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Screen = "list" | "form";

function EmailRow({
  item,
  dict,
  busy,
  onRemove,
}: {
  item: AuthAccountEmail;
  dict: Dict;
  busy: boolean;
  onRemove: (item: AuthAccountEmail) => void;
}) {
  const source =
    item.source === "animu"
      ? dict.ACCOUNT_ANIMU_CONNECT
      : item.provider || dict.ACCOUNT_EMAIL_PROVIDER;
  const verifiedLabel = item.verified
    ? dict.ACCOUNT_EMAIL_VERIFIED
    : dict.ACCOUNT_EMAIL_NOT_VERIFIED;

  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowEmail}>{item.email}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.badge}>{source}</Text>
          <Text
            style={[
              styles.badge,
              item.verified ? styles.badgeVerified : styles.badgePending,
            ]}
          >
            {verifiedLabel}
          </Text>
        </View>
      </View>
      {item.removable && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={dict.ACCOUNT_EMAIL_REMOVE}
          activeOpacity={0.7}
          disabled={busy}
          onPress={() => onRemove(item)}
          style={styles.removeButton}
        >
          <Text style={styles.removeText}>{dict.ACCOUNT_EMAIL_REMOVE}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmailList({
  emails,
  loading,
  dict,
  busy,
  onRemove,
}: {
  emails: AuthAccountEmail[];
  loading: boolean;
  dict: Dict;
  busy: boolean;
  onRemove: (item: AuthAccountEmail) => void;
}) {
  if (loading) {
    return <ActivityIndicator color={THEME.COLORS.TEXT} style={styles.loading} />;
  }

  if (emails.length === 0) {
    return (
      <View style={styles.list}>
        <Text style={styles.empty}>{dict.ACCOUNT_EMAIL_EMPTY}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {emails.map((item) => (
        <EmailRow
          key={item.id}
          item={item}
          dict={dict}
          busy={busy}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

function EmailCodeForm({
  flow,
  dict,
  busy,
  onCancel,
}: {
  flow: EmailCodeFlow;
  dict: Dict;
  busy: boolean;
  onCancel: () => void;
}) {
  const onEmailStep = flow.step === "email";

  return (
    <>
      <EmailCodeFields flow={flow} />

      {flow.error && <Text style={styles.error}>{flow.error}</Text>}

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={flow.busy}
        onPress={onEmailStep ? flow.sendCode : flow.verify}
        style={[styles.submit, flow.busy && styles.submitDisabled]}
      >
        {flow.busy ? (
          <ActivityIndicator color={THEME.COLORS.TEXT_ON_LIGHT} />
        ) : (
          <Text style={styles.submitText}>
            {onEmailStep ? dict.LOGIN_SEND_CODE : dict.ACCOUNT_SAVE}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={busy}
        onPress={onCancel}
        style={styles.cancel}
      >
        <Text style={styles.cancelText}>{dict.ACCOUNT_CANCEL}</Text>
      </TouchableOpacity>
    </>
  );
}

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

  const isList = screen === "list";

  return (
    <Sheet visible={visible} onClose={handleClose} withKeyboard closable={!busy}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {isList ? dict.ACCOUNT_ANIMU_CONNECT : dict.ACCOUNT_EMAIL_ADD}
        </Text>
        <Text style={styles.subtitle}>
          {flow.step === "code"
            ? dict.LOGIN_CODE_SUBTITLE.replace("{email}", flow.email.trim())
            : dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT}
        </Text>

        {isList ? (
          <>
            <EmailList
              emails={emails}
              loading={loading}
              dict={dict}
              busy={busy}
              onRemove={confirmRemove}
            />

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
          <EmailCodeForm
            flow={flow}
            dict={dict}
            busy={busy}
            onCancel={reset}
          />
        )}
      </ScrollView>
    </Sheet>
  );
}
