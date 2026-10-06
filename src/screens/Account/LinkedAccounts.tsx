import { Icon } from "@/components/Icon";
import type { LinkedProvider, ProviderInfo } from "animu-api";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { IconBox, RowBody, RowDivider } from "@/components/ListRow";
import { MaskedValue } from "@/components/MaskedValue";
import { ProviderIcon } from "@/components/ProviderIcon";
import { SectionTitle } from "@/components/SectionTitle";
import { isProviderConfigured, isProviderLinkable } from "@/constants/auth";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { styles } from "@/screens/Account/styles";
import { providerDisplay } from "@/screens/Account/identity";

interface Props {
  /** Server list merged with the known providers (unconfigured render as soon). */
  providers: ProviderInfo[];
  linkedProviders: LinkedProvider[];
  /** At least one social provider must remain linked. */
  canUnlink: boolean;
  /** The in-flight action key, or null. */
  busy: string | null;
  onLink: (provider: string) => void;
  onUnlink: (provider: string) => void;
}

interface ActionProps {
  provider: ProviderInfo;
  linked: boolean;
  canUnlink: boolean;
  busy: string | null;
  onLink: (provider: string) => void;
  onUnlink: (provider: string) => void;
}

/** The trailing action: a spinner while in flight, else unlink / link / none. */
function RowAction({
  provider,
  linked,
  canUnlink,
  busy,
  onLink,
  onUnlink,
}: Readonly<ActionProps>) {
  const dict = useDict();

  if (busy === `link-${provider.name}`) {
    return (
      <ActivityIndicator
        size="small"
        color={THEME.COLORS.SPINNER}
        style={styles.rowActionBusy}
      />
    );
  }

  if (linked) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${dict.ACCOUNT_UNLINK} ${provider.label}`}
        disabled={!canUnlink || !!busy}
        activeOpacity={THEME.OPACITY.PRESSED}
        hitSlop={THEME.HIT_SLOP.SM}
        style={[
          styles.rowIconAction,
          (!canUnlink || !!busy) && styles.rowActionDisabled,
        ]}
        onPress={() => onUnlink(provider.name)}
      >
        <Icon
          name="link-off"
          size={THEME.ICON.MD}
          color={
            !canUnlink || !!busy ? THEME.COLORS.TEXT_DIM : THEME.COLORS.TEXT
          }
        />
      </TouchableOpacity>
    );
  }

  if (isProviderLinkable(provider.name)) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${dict.ACCOUNT_LINK} ${provider.label}`}
        disabled={!!busy}
        activeOpacity={THEME.OPACITY.PRESSED}
        hitSlop={THEME.HIT_SLOP.SM}
        style={[styles.rowIconAction, !!busy && styles.rowActionDisabled]}
        onPress={() => onLink(provider.name)}
      >
        <Icon
          name="add-link"
          size={THEME.ICON.MD}
          color={THEME.COLORS.BRAND}
        />
      </TouchableOpacity>
    );
  }

  return null;
}

/** One provider row: icon, label, masked identity or link state, and action. */
function ProviderRow({
  provider,
  linkedInfo,
  showDivider,
  ...actionProps
}: Readonly<
  Omit<ActionProps, "linked"> & {
    linkedInfo: LinkedProvider | undefined;
    showDivider: boolean;
  }
>) {
  const dict = useDict();
  const linked = !!linkedInfo;
  const display = linkedInfo ? providerDisplay(linkedInfo) : null;

  return (
    <View>
      {showDivider && <RowDivider />}
      <View style={styles.row}>
        <IconBox>
          <ProviderIcon provider={provider.name} size={THEME.ICON.MD} />
        </IconBox>
        <RowBody label={provider.label}>
          {linked && display ? (
            <MaskedValue
              value={display.value}
              mask={() => display.masked}
              textStyle={styles.rowCaption}
              showLabel={dict.ACCOUNT_SHOW}
              hideLabel={dict.ACCOUNT_HIDE}
              iconSize={14}
            />
          ) : (
            <Text style={styles.rowCaption} numberOfLines={1}>
              {linked ? dict.ACCOUNT_LINKED : dict.ACCOUNT_NOT_LINKED}
            </Text>
          )}
        </RowBody>
        <RowAction provider={provider} linked={linked} {...actionProps} />
      </View>
    </View>
  );
}

/** The linked-accounts group: one row per provider with link/unlink actions. */
export function LinkedAccounts({
  providers,
  linkedProviders,
  canUnlink,
  busy,
  onLink,
  onUnlink,
}: Readonly<Props>) {
  const dict = useDict();

  // Unconfigured providers are omitted entirely rather than rendered as a
  // disabled "soon" row (App Review flags placeholder text, 2.1(a)).
  const visibleProviders = providers.filter((provider) =>
    isProviderConfigured(provider.name),
  );

  return (
    <>
      <SectionTitle title={dict.ACCOUNT_LINKED_ACCOUNTS} icon="link" />
      <View style={styles.group}>
        {visibleProviders.map((provider, index) => (
          <ProviderRow
            key={provider.name}
            provider={provider}
            linkedInfo={linkedProviders.find(
              (entry) => entry.provider === provider.name,
            )}
            showDivider={index > 0}
            canUnlink={canUnlink}
            busy={busy}
            onLink={onLink}
            onUnlink={onUnlink}
          />
        ))}
      </View>
      {!canUnlink && linkedProviders.length === 1 && (
        <Text style={styles.footnote}>{dict.ACCOUNT_LAST_PROVIDER}</Text>
      )}
    </>
  );
}
