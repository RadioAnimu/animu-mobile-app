import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import type { LinkedProvider, ProviderInfo } from "animu-api";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

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

/** The linked-accounts group: one row per provider with link/unlink actions. */
export function LinkedAccounts({
  providers,
  linkedProviders,
  canUnlink,
  busy,
  onLink,
  onUnlink,
}: Props) {
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
        {visibleProviders.map((provider, index) => {
          const linkedInfo = linkedProviders.find(
            (entry) => entry.provider === provider.name,
          );
          const linked = !!linkedInfo;
          const linkable = isProviderLinkable(provider.name);
          const rowBusy = busy === `link-${provider.name}`;
          const display = linkedInfo ? providerDisplay(linkedInfo) : null;
          return (
            <View key={provider.name}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <ProviderIcon provider={provider.name} size={THEME.ICON.MD} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{provider.label}</Text>
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
                </View>
                {rowBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={THEME.COLORS.TEXT_DIM}
                    style={styles.rowActionBusy}
                  />
                ) : linked ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${dict.ACCOUNT_UNLINK} ${provider.label}`}
                    disabled={!canUnlink || !!busy}
                    activeOpacity={0.7}
                    hitSlop={8}
                    style={[
                      styles.rowIconAction,
                      (!canUnlink || !!busy) && styles.rowActionDisabled,
                    ]}
                    onPress={() => onUnlink(provider.name)}
                  >
                    <MaterialIcons
                      name="link-off"
                      size={THEME.ICON.MD}
                      color={
                        !canUnlink || !!busy
                          ? THEME.COLORS.TEXT_DIM
                          : THEME.COLORS.TEXT_SOFT
                      }
                    />
                  </TouchableOpacity>
                ) : linkable ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${dict.ACCOUNT_LINK} ${provider.label}`}
                    disabled={!!busy}
                    activeOpacity={0.7}
                    hitSlop={8}
                    style={[
                      styles.rowIconAction,
                      !!busy && styles.rowActionDisabled,
                    ]}
                    onPress={() => onLink(provider.name)}
                  >
                    <MaterialIcons
                      name="add-link"
                      size={THEME.ICON.MD}
                      color={THEME.COLORS.BRAND}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );
}
