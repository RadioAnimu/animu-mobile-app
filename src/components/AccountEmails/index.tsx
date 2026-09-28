import { useEffect, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import type { AuthAccountEmail, LinkedProvider } from "animu-api";
import {
  ActivityIndicator,
  Alert,
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
import { providerLabel } from "@/constants/auth";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { layoutEase } from "@/utils/layout-animation";
import { interpolate } from "@/utils/format";
import { maskEmail } from "@/utils/mask";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { MaskedValue } from "@/components/MaskedValue";
import { ProviderIcon } from "@/components/ProviderIcon";
import { styles } from "@/components/AccountEmails/styles";

/** The extra Animu Connect address rides `source: "animu"` (the provider
 * rows carry their own sources) — one predicate so both reads stay in step. */
const isExtraEmail = (item: AuthAccountEmail): boolean =>
  item.source === "animu";

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
        <LeadingMarks providers={providers} />
      </View>
      <View style={styles.emailBody}>
        {/* Masked by default: the address is personal, the reveal is one tap. */}
        <MaskedValue
          value={email}
          mask={maskEmail}
          textStyle={styles.emailValue}
          showLabel={dict.ACCOUNT_SHOW}
          hideLabel={dict.ACCOUNT_HIDE}
          iconSize={14}
        />
      </View>
      <View style={styles.emailTrailing}>
        {isExtra && (
          <Text style={styles.badge}>{dict.ACCOUNT_EMAIL_EXTRA}</Text>
        )}
        {removableItem && (
          <TouchableOpacity
            accessibilityRole="button"
            // The masked form, or the label would undo the hidden address.
            accessibilityLabel={`${dict.ACCOUNT_EMAIL_REMOVE} ${maskEmail(email)}`}
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

/** The four corners of the leading square, filled in this order. */
const MARK_CORNERS = [
  styles.markTopRight,
  styles.markBottomLeft,
  styles.markTopLeft,
  styles.markBottomRight,
];

/**
 * The row's leading slot: the providers that registered the address, laid out
 * diagonally in the square's corners (top-right, then bottom-left, then the
 * remaining two) so several marks share the one icon column. A single
 * provider renders bare, matching the Linked Accounts rows; a fifth would
 * collapse into a `+N` chip. The extra Animu Connect address has no provider
 * and shows an envelope instead.
 */
function LeadingMarks({
  providers,
}: {
  providers: NonNullable<AuthAccountEmail["provider"]>[];
}) {
  if (providers.length === 0) {
    return (
      <MaterialIcons
        name="mail"
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT}
        style={styles.iconGlyph}
      />
    );
  }

  const label = providers
    .map((provider) => providerLabel(provider))
    .join(", ");

  if (providers.length === 1) {
    return (
      <View accessible accessibilityLabel={label}>
        <ProviderIcon
          provider={providers[0]}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT}
        />
      </View>
    );
  }

  const shown =
    providers.length > MARK_CORNERS.length
      ? providers.slice(0, MARK_CORNERS.length - 1)
      : providers;
  const overflow = providers.length - shown.length;

  return (
    <View accessible accessibilityLabel={label} style={styles.markGrid}>
      {shown.map((provider, index) => (
        <View key={provider} style={[styles.markChip, MARK_CORNERS[index]]}>
          <ProviderIcon
            provider={provider}
            size={scale(13)}
            color={THEME.COLORS.TEXT}
          />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.markChip, MARK_CORNERS[shown.length]]}>
          <Text style={styles.markOverflow}>+{overflow}</Text>
        </View>
      )}
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
 * with both marks instead of duplicating. A deployment that reports only one
 * provider per address is reconciled against the linked providers that carry
 * the same `providerEmail`, so no mark is lost.
 */
function groupEmails(
  emails: AuthAccountEmail[],
  linkedProviders: LinkedProvider[],
  providerOrder: string[],
): EmailGroup[] {
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
      isExtra: isExtraEmail(item),
      removableItem: item.removable ? item : null,
    });
  }

  // Available-provider order: the marks then read in the same sequence as the
  // Linked Accounts rows above, not in whatever order the addresses arrived.
  const order = new Map(providerOrder.map((name, index) => [name, index]));

  for (const group of groups.values()) {
    const key = group.email.toLowerCase();
    for (const linked of linkedProviders) {
      if (!linked.providerEmail) continue;
      if (linked.providerEmail.trim().toLowerCase() !== key) continue;
      if (!group.providers.includes(linked.provider)) {
        group.providers.push(linked.provider);
      }
    }
    group.providers.sort(
      (a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity),
    );
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
 * Animu Connect management, listed in place on the Account screen: every
 * address with the providers that registered it (masked until revealed), the
 * optional single extra address with its delete action, and the inline add
 * form. No collapse and no modal, matching the other Account groups.
 */
export function AccountEmails() {
  const {
    emails,
    profile,
    providers,
    refreshEmails,
    requestAddEmail,
    verifyAddEmail,
    removeEmail,
  } = useAuth();
  const { toast, error: showError } = useAlert();
  const dict = useDict();

  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("list");
  const [removing, setRemoving] = useState(false);

  const mapEmailError = (error: unknown) =>
    emailCodeError(dict, error, dict.ACCOUNT_ACTION_FAILED, {
      taken: dict.ACCOUNT_EMAIL_TAKEN,
    });

  const flow = useEmailCodeFlow({
    requestCode: requestAddEmail,
    verifyCode: verifyAddEmail,
    onCodeSent: () => toast(dict.LOGIN_CODE_SENT),
    onVerified: () => {
      toast(dict.ACCOUNT_EMAIL_SAVED);
      setScreen("list");
    },
    mapRequestError: mapEmailError,
    mapVerifyError: mapEmailError,
  });

  const busy = flow.busy || removing;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refreshEmails().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshEmails]);

  // There is at most ONE extra `animu` email — when it exists the action
  // replaces it rather than adding another.
  const extraEmail = emails.find(isExtraEmail) ?? null;

  const groups = groupEmails(
    emails,
    profile?.linkedProviders ?? [],
    providers.map((provider) => provider.name),
  );

  const confirmRemove = (target: AuthAccountEmail) => {
    Alert.alert(
      dict.ACCOUNT_EMAIL_REMOVE_CONFIRM_TITLE,
      interpolate(dict.ACCOUNT_EMAIL_REMOVE_CONFIRM_MSG, { email: target.email }),
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

  return (
    <View>
      <Text style={styles.hint}>
        {screen === "form"
          ? flow.step === "code"
            ? interpolate(dict.LOGIN_CODE_SUBTITLE, { email: flow.email.trim() })
            : dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT
          : dict.ACCOUNT_ANIMU_CONNECT_DESC}
      </Text>

      {screen === "form" ? (
        <EmailCodeForm
          flow={flow}
          dict={dict}
          onCancel={() => {
            layoutEase();
            flow.reset();
            setScreen("list");
          }}
        />
      ) : loading && emails.length === 0 ? (
        <ActivityIndicator
          color={THEME.COLORS.TEXT_DIM}
          style={styles.loading}
        />
      ) : (
        <>
          {groups.length === 0 ? (
            <Text style={styles.empty}>{dict.ACCOUNT_EMAIL_EMPTY}</Text>
          ) : (
            groups.map((group, index) => (
              <View key={group.email}>
                {index > 0 && <View style={styles.divider} />}
                <EmailRow
                  email={group.email}
                  providers={group.providers}
                  isExtra={group.isExtra}
                  removableItem={group.removableItem}
                  dict={dict}
                  busy={busy}
                  onRemove={confirmRemove}
                />
              </View>
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
                layoutEase();
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
      )}
    </View>
  );
}
