import { useEffect, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import type { AuthAccountEmail } from "animu-api";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
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
import { scale } from "@/theme/responsive";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { ProviderIcon } from "@/components/ProviderIcon";
import { styles } from "@/components/AccountEmails/styles";

type Screen = "list" | "form";

function EmailRow({
  email,
  providers,
  isExtra,
  removableItem,
  dict,
  busy,
  onRemove,
}: {
  email: string;
  /** Providers that auto-registered this address (may be several). */
  providers: NonNullable<AuthAccountEmail["provider"]>[];
  /** The extra Animu Connect email (a single, user-added address). */
  isExtra: boolean;
  /** The row to delete, when this address is removable. */
  removableItem: AuthAccountEmail | null;
  dict: Dict;
  busy: boolean;
  onRemove: (item: AuthAccountEmail) => void;
}) {
  return (
    <View style={styles.emailRow}>
      <View style={styles.emailIcon}>
        <MaterialIcons
          name={isExtra ? "alternate-email" : "mail"}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
          style={styles.iconGlyph}
        />
      </View>
      <Text style={styles.emailValue} numberOfLines={1}>
        {email}
      </Text>
      {/* Marks sit flush right so a long address never pushes them around. */}
      <View style={styles.emailTrailing}>
        {isExtra ? (
          <Text style={styles.badge}>{dict.ACCOUNT_EMAIL_EXTRA}</Text>
        ) : (
          <ProviderMarks providers={providers} />
        )}
        {removableItem && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${dict.ACCOUNT_EMAIL_REMOVE} ${email}`}
            activeOpacity={0.7}
            disabled={busy}
            hitSlop={8}
            onPress={() => onRemove(removableItem)}
            style={[styles.removeButton, busy && styles.disabled]}
          >
            <MaterialIcons
              name="delete-outline"
              size={THEME.ICON.MD}
              color={THEME.COLORS.ERROR}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** One provider mark per provider, in the order the server returned them. */
function ProviderMarks({
  providers,
  max = 3,
}: {
  providers: NonNullable<AuthAccountEmail["provider"]>[];
  max?: number;
}) {
  const shown = providers.slice(0, max);
  const overflow = providers.length - shown.length;
  return (
    <View style={styles.providerMarks}>
      {shown.map((provider) => (
        /* A fixed square per mark keeps glyph and SVG brands on the same
           optical center and gives them a consistent footprint. */
        <View key={provider} style={styles.providerMark}>
          <ProviderIcon
            provider={provider}
            size={scale(16)}
            color={THEME.COLORS.TEXT_DIM}
          />
        </View>
      ))}
      {overflow > 0 && <Text style={styles.providerOverflow}>+{overflow}</Text>}
    </View>
  );
}

/** A grouped list entry: one address plus every provider that registered it. */
interface EmailGroup {
  email: string;
  providers: NonNullable<AuthAccountEmail["provider"]>[];
  isExtra: boolean;
  removableItem: AuthAccountEmail | null;
}

/**
 * Collapses the server's row-per-(email, provider) list into one entry per
 * address, so the same address registered by e.g. Google and Apple shows once
 * with both marks instead of duplicating.
 */
function groupEmails(emails: AuthAccountEmail[]): EmailGroup[] {
  const groups = new Map<string, EmailGroup>();
  for (const item of emails) {
    const key = item.email.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      if (item.provider && !existing.providers.includes(item.provider)) {
        existing.providers.push(item.provider);
      }
      if (item.removable) existing.removableItem = item;
      continue;
    }
    groups.set(key, {
      email: item.email,
      providers: item.provider ? [item.provider] : [],
      isExtra: item.source === "animu",
      removableItem: item.removable ? item : null,
    });
  }
  return [...groups.values()];
}

function EmailCodeForm({
  flow,
  dict,
  onCancel,
}: {
  flow: EmailCodeFlow;
  dict: Dict;
  onCancel: () => void;
}) {
  const onEmailStep = flow.step === "email";

  return (
    <View style={styles.form}>
      <EmailCodeFields flow={flow} />

      {flow.error && <Text style={styles.error}>{flow.error}</Text>}

      <View style={styles.formActions}>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={flow.busy}
          onPress={onCancel}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>{dict.ACCOUNT_CANCEL}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={flow.busy}
          onPress={onEmailStep ? flow.sendCode : flow.verify}
          style={[styles.submit, flow.busy && styles.disabled]}
        >
          {flow.busy ? (
            <ActivityIndicator color={THEME.COLORS.TEXT_ON_LIGHT} />
          ) : (
            <Text style={styles.submitText}>
              {onEmailStep ? dict.LOGIN_SEND_CODE : dict.ACCOUNT_SAVE}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Inline email management for the Account screen: the expandable row reveals
 * the account's Animu Connect addresses in place — no modal, matching the
 * Settings dropdowns (e.g. cover quality). Provider emails are automatic; at
 * most one extra address can be added.
 */
export function AccountEmails() {
  const {
    emails,
    refreshEmails,
    requestAddEmail,
    verifyAddEmail,
    removeEmail,
  } = useAuth();
  const { toast, error: showError } = useAlert();
  const dict = useDict();

  const [open, setOpen] = useState(false);
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
    if (!open) return;
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
  }, [open]);

  const animate = () =>
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });

  const toggle = () => {
    animate();
    if (open) {
      flow.reset();
      setScreen("list");
    }
    setOpen((current) => !current);
  };

  // There is at most ONE extra `animu` email — when it exists the action
  // replaces it rather than adding another.
  const extraEmail = emails.find((item) => item.source === "animu") ?? null;

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
                console.error("[AccountEmails] Remove email failed:", err);
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

  const extraSummary = extraEmail
    ? dict.ACCOUNT_ANIMU_CONNECT_READY_AS.replace("{email}", extraEmail.email)
    : dict.ACCOUNT_ANIMU_CONNECT_DESC;

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        activeOpacity={0.7}
        onPress={toggle}
        style={styles.trigger}
      >
        <View style={styles.triggerIcon}>
          <MaterialIcons
            name="alternate-email"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
            style={styles.iconGlyph}
          />
        </View>
        <View style={styles.triggerBody}>
          <Text style={styles.triggerLabel}>{dict.ACCOUNT_ANIMU_CONNECT}</Text>
          <Text style={styles.triggerCaption} numberOfLines={1}>
            {extraSummary}
          </Text>
        </View>
        <MaterialIcons
          name={open ? "expand-less" : "expand-more"}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.panel}>
          <Text style={styles.hint}>
            {screen === "form" && flow.step === "code"
              ? dict.LOGIN_CODE_SUBTITLE.replace("{email}", flow.email.trim())
              : dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT}
          </Text>

          {loading ? (
            <ActivityIndicator
              color={THEME.COLORS.TEXT_DIM}
              style={styles.loading}
            />
          ) : screen === "list" ? (
            <>
              {emails.length === 0 ? (
                <Text style={styles.empty}>{dict.ACCOUNT_EMAIL_EMPTY}</Text>
              ) : (
                groupEmails(emails).map((group) => (
                  <EmailRow
                    key={group.email}
                    email={group.email}
                    providers={group.providers}
                    isExtra={group.isExtra}
                    removableItem={group.removableItem}
                    dict={dict}
                    busy={busy}
                    onRemove={confirmRemove}
                  />
                ))
              )}

              {flow.error && <Text style={styles.error}>{flow.error}</Text>}

              {/*
                The server allows only ONE extra email and rejects a new add
                while it exists, so the action is hidden until the current one
                is removed (the row above carries the delete button).
              */}
              {!extraEmail && (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  disabled={busy}
                  onPress={() => {
                    animate();
                    flow.reset();
                    setScreen("form");
                  }}
                  style={[styles.addButton, busy && styles.disabled]}
                >
                  <MaterialIcons
                    name="add"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT}
                  />
                  <Text style={styles.addText}>{dict.ACCOUNT_EMAIL_ADD}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <EmailCodeForm
              flow={flow}
              dict={dict}
              onCancel={() => {
                animate();
                flow.reset();
                setScreen("list");
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
