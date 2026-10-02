import { Fragment, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
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
import { RESEND_COOLDOWN_SECONDS } from "@/constants/email-code";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";
import { interpolate } from "@/utils/format";
import { maskEmail } from "@/utils/mask";
import { CodeSubtitle } from "@/components/CodeSubtitle";
import { ConnectActions } from "@/components/ConnectActions";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { FormError } from "@/components/FormError";
import { LeadingIcon } from "@/components/ListRow";
import { MaskedValue } from "@/components/MaskedValue";
import { ProviderIcon } from "@/components/ProviderIcon";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { styles } from "@/components/AccountEmails/styles";

/** The extra Animu Connect address rides `source: "animu"` (the provider
 * rows carry their own sources) — one predicate so both reads stay in step. */
const isExtraEmail = (item: AuthAccountEmail): boolean =>
  item.source === "animu";

/** Where an address came from: a provider and the label to show by its mark. */
interface EmailSource {
  /** `null` for the extra address: the row's own mail icon already says it. */
  provider: string | null;
  label: string;
}

/** One address row: the masked address, the sources that registered it as
 * `mark + name` pairs, and — when the server allows it — the delete. */
function EmailRow({
  email,
  sources,
  removableItem,
  dict,
  busy,
  onRemove,
}: {
  email: string;
  /** Every provider that registered the address (or Animu Connect itself). */
  sources: EmailSource[];
  /** The row to delete, when this address is removable. */
  removableItem: AuthAccountEmail | null;
  dict: Dict;
  busy: boolean;
  onRemove: (item: AuthAccountEmail) => void;
}) {
  return (
    <View style={styles.emailRow}>
      <LeadingIcon name="mail-outline" />
      <View style={styles.emailBody}>
        {/* Masked by default: the address is personal, the reveal is one tap. */}
        <MaskedValue
          value={email}
          mask={maskEmail}
          textStyle={styles.emailValue}
          showLabel={dict.ACCOUNT_SHOW}
          hideLabel={dict.ACCOUNT_HIDE}
          iconSize={THEME.ICON.SM}
        />
        {sources.length > 0 && (
          <View style={styles.emailSourceRow}>
            {sources.map((source, index) => (
              <Fragment key={`${source.provider}:${source.label}`}>
                {index > 0 && (
                  <Text style={styles.emailSourceSeparator}>·</Text>
                )}
                {source.provider && (
                  <ProviderIcon provider={source.provider} size={THEME.ICON.SM} />
                )}
                <Text style={styles.emailSource} numberOfLines={1}>
                  {source.label}
                </Text>
              </Fragment>
            ))}
          </View>
        )}
      </View>
      {removableItem && (
        <TouchableOpacity
          accessibilityRole="button"
          // The masked form, or the label would undo the hidden address.
          accessibilityLabel={`${dict.ACCOUNT_EMAIL_REMOVE} ${maskEmail(email)}`}
          activeOpacity={THEME.OPACITY.PRESSED}
          disabled={busy}
          hitSlop={THEME.HIT_SLOP.SM}
          onPress={() => onRemove(removableItem)}
          style={[styles.removeButton, busy && styles.disabled]}
        >
          <Icon
            name="delete-outline"
            size={THEME.ICON.MD}
            color={THEME.COLORS.ERROR}
          />
        </TouchableOpacity>
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
 * with both providers instead of duplicating. A deployment that reports only
 * one provider per address is reconciled against the linked providers that
 * carry the same `providerEmail`, so no provenance is lost.
 */
function groupEmails(
  emails: AuthAccountEmail[],
  linkedProviders: LinkedProvider[],
  providerOrder: string[],
): EmailGroup[] {
  const groups = collectGroups(emails);

  // Available-provider order: the marks then read in the same sequence as the
  // Linked Accounts rows above, not in whatever order the addresses arrived.
  const order = new Map(providerOrder.map((name, index) => [name, index]));

  for (const group of groups.values()) {
    addLinkedProviders(group, linkedProviders);
    group.providers.sort(
      (a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity),
    );
  }

  return [...groups.values()];
}

/** One group per address (case-insensitive), merging the per-provider rows. */
function collectGroups(emails: AuthAccountEmail[]): Map<string, EmailGroup> {
  const groups = new Map<string, EmailGroup>();
  for (const item of emails) {
    const key = item.email.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      mergeIntoGroup(existing, item);
    } else {
      groups.set(key, {
        email: item.email,
        providers: item.provider ? [item.provider] : [],
        isExtra: isExtraEmail(item),
        removableItem: item.removable ? item : null,
      });
    }
  }
  return groups;
}

/** Folds another row for the same address into its group. */
function mergeIntoGroup(group: EmailGroup, item: AuthAccountEmail): void {
  if (item.provider && !group.providers.includes(item.provider)) {
    group.providers.push(item.provider);
  }
  if (item.removable) group.removableItem = item;
}

/** Adds every linked provider whose `providerEmail` is this group's address. */
function addLinkedProviders(
  group: EmailGroup,
  linkedProviders: LinkedProvider[],
): void {
  const key = group.email.toLowerCase();
  const present = new Set(group.providers);
  for (const linked of linkedProviders) {
    const sameAddress =
      !!linked.providerEmail &&
      linked.providerEmail.trim().toLowerCase() === key;
    if (sameAddress && !present.has(linked.provider)) {
      present.add(linked.provider);
      group.providers.push(linked.provider);
    }
  }
}

/** The addresses, each with its provenance, or the empty notice. */
function EmailList({
  groups,
  dict,
  busy,
  onRemove,
}: {
  groups: EmailGroup[];
  dict: Dict;
  busy: boolean;
  onRemove: (item: AuthAccountEmail) => void;
}) {
  if (groups.length === 0) {
    return <Text style={styles.empty}>{dict.ACCOUNT_EMAIL_EMPTY}</Text>;
  }

  return (
    <>
      {groups.map((group, index) => (
        <View key={group.email}>
          {index > 0 && <View style={styles.divider} />}
          <EmailRow
            email={group.email}
            // The caption pairs each mark with its name; the extra address has
            // no provider, so it names Animu Connect instead.
            sources={
              group.isExtra
                ? [{ provider: null, label: dict.ACCOUNT_EMAIL_EXTRA_DESC }]
                : group.providers.map((provider) => ({
                    provider,
                    label: providerLabel(provider),
                  }))
            }
            removableItem={group.removableItem}
            dict={dict}
            busy={busy}
            onRemove={onRemove}
          />
        </View>
      ))}
    </>
  );
}

/**
 * The inline add form, shown inside the card only while the account has no
 * extra email: the explanation, the email field (swapping to the code field)
 * and the code step's resend / change-email links. No modal — the Account
 * scroll view keeps the focused field above the keyboard.
 */
function AddEmailForm({
  flow,
  dict,
  resendRemaining,
  onResend,
  onChangeEmail,
}: {
  flow: EmailCodeFlow;
  dict: Dict;
  resendRemaining: number;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const onCodeStep = flow.step === "code";

  return (
    <View style={styles.form}>
      <Text style={styles.formHint}>
        {onCodeStep ? (
          <CodeSubtitle
            template={dict.LOGIN_CODE_SUBTITLE}
            email={flow.email.trim()}
          />
        ) : (
          dict.ACCOUNT_ANIMU_CONNECT_FORM_HINT
        )}
      </Text>

      <EmailCodeFields flow={flow} />

      {flow.error && (
        <View style={styles.formError}>
          <FormError message={flow.error} />
        </View>
      )}

      {/* The email step's button carries its own spinner. */}
      {flow.busy && onCodeStep && (
        <View style={styles.formBusy}>
          <ActivityIndicator color={THEME.COLORS.SPINNER} />
        </View>
      )}

      {onCodeStep && (
        <View style={styles.formActions}>
          <ConnectActions
            busy={flow.busy}
            resendRemaining={resendRemaining}
            onResend={onResend}
            onChangeEmail={onChangeEmail}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Animu Connect management on the Account screen. Animu Connect is a sign-in
 * method (a code emailed to any listed address); the card lists every address with the brand mark it came from and the
 * providers that registered it (masked until revealed). While the account has
 * no extra email, the card closes on an inline add form; the server allows
 * only one extra address, so the form gives way to that row (with its delete)
 * once it exists.
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
  const [removing, setRemoving] = useState(false);
  const resend = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  const mapEmailError = (error: unknown) =>
    emailCodeError(dict, error, dict.ACCOUNT_ACTION_FAILED, {
      taken: dict.ACCOUNT_EMAIL_TAKEN,
    });

  const flow = useEmailCodeFlow({
    requestCode: requestAddEmail,
    verifyCode: verifyAddEmail,
    onCodeSent: () => {
      resend.start();
      toast(dict.LOGIN_CODE_SENT);
    },
    onVerified: () => {
      haptics.success();
      toast(dict.ACCOUNT_EMAIL_SAVED);
    },
    mapRequestError: mapEmailError,
    mapVerifyError: mapEmailError,
  });

  const busy = flow.busy || removing;
  const showLoading = loading && emails.length === 0;

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

  // There is at most ONE extra `animu` email — while it exists the server
  // rejects another, so the inline form hides and its row carries the delete.
  const extraEmail = emails.find(isExtraEmail) ?? null;

  const groups = groupEmails(
    emails,
    profile?.linkedProviders ?? [],
    providers.map((provider) => provider.name),
  );

  const confirmRemove = (target: AuthAccountEmail) => {
    Alert.alert(
      dict.ACCOUNT_EMAIL_REMOVE_CONFIRM_TITLE,
      interpolate(dict.ACCOUNT_EMAIL_REMOVE_CONFIRM_MSG, {
        email: target.email,
      }),
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
      {showLoading ? (
        <ActivityIndicator
          color={THEME.COLORS.SPINNER}
          style={styles.loading}
        />
      ) : (
        <>
          <EmailList
            groups={groups}
            dict={dict}
            busy={busy}
            onRemove={confirmRemove}
          />

          {!extraEmail && (
            <>
              {groups.length > 0 && <View style={styles.divider} />}
              <AddEmailForm
                flow={flow}
                dict={dict}
                resendRemaining={resend.remaining}
                onResend={() => void flow.sendCode()}
                onChangeEmail={flow.backToEmail}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}
