import { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimuApiError, type LinkedProvider } from "animu-api";
import { Background } from "../../components/Background";
import { Avatar } from "../../components/Avatar";
import { BackArrow } from "../../components/BackArrow";
import { AnimuConnectSheet } from "../../components/AnimuConnectSheet";
import { ProviderIcon } from "../../components/ProviderIcon";
import { SectionTitle } from "../../components/SectionTitle";
import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { getUserName } from "../../core/domain/user";
import { AuthFlowCancelled } from "../../core/auth";
import {
  isProviderConfigured,
  isProviderLinkable,
  providerLabel,
} from "../../constants/auth";
import { buildAuthImageSource } from "../../utils/authImage";
import { DICT } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { AVATAR, HEADER_HEIGHT, styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

/**
 * Identity line for a linked provider: Discord shows its `@handle` (or the
 * numeric id), Google/Apple show `name · email`. Falls back to whatever the
 * server supplied, then the provider user id.
 */
function linkedProviderDetail(provider: LinkedProvider): string | null {
  const handle = provider.providerUsername
    ? `@${provider.providerUsername}`
    : null;

  if (provider.provider === "discord") {
    return handle ?? (provider.providerUserId || null);
  }

  const parts = [provider.providerName, provider.providerEmail].filter(
    (part): part is string => !!part,
  );
  if (parts.length > 0) return parts.join(" · ");
  return handle ?? (provider.providerUserId || null);
}

export function Account({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { settings } = useUserSettings();
  const { toast, error: showError } = useAlert();
  const {
    user,
    profile,
    providers,
    isAuthenticated,
    credentialsSet,
    credentialsUsername,
    imageVersion,
    logout,
    deleteAccount,
    refreshProfile,
    linkProvider,
    unlinkProvider,
  } = useAuth();
  const dict = DICT[settings.selectedLanguage];

  const [busy, setBusy] = useState<string | null>(null);
  const [connectVisible, setConnectVisible] = useState(false);

  const handle = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (error) {
      if (error instanceof AuthFlowCancelled) {
        // User dismissed the OAuth prompt — not worth an error.
      } else if (
        error instanceof AnimuApiError &&
        error.code === "last_provider"
      ) {
        showError(dict.ACCOUNT_LAST_PROVIDER);
      } else {
        console.error(`[Account] ${key} action failed:`, error);
        showError(dict.ACCOUNT_ACTION_FAILED);
      }
    } finally {
      setBusy(null);
    }
  };

  const linkedProviders = profile?.linkedProviders ?? [];
  // `providers` is already the server list merged with the known providers,
  // so unconfigured ones (Apple) render as "coming soon" here too.
  const availableProviders = providers;

  const canUnlink = linkedProviders.length > 1;

  const confirmDelete = () => {
    Alert.alert(
      dict.ACCOUNT_DELETE_CONFIRM_TITLE,
      dict.ACCOUNT_DELETE_CONFIRM_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.ACCOUNT_DELETE,
          style: "destructive",
          onPress: () => {
            void handle("delete", async () => {
              await deleteAccount();
              navigation.navigate("Home");
            });
          },
        },
      ],
    );
  };

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => navigation.goBack()}
        style={styles.headerButton}
      >
        <BackArrow />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{dict.ACCOUNT_TITLE}</Text>
      <View style={styles.headerButton} />
    </View>
  );

  if (!isAuthenticated || !user) {
    return (
      <Background>
        <SafeAreaView
          style={styles.container}
          edges={["left", "right", "bottom"]}
        >
          {renderHeader()}
          <View style={styles.signedOut}>
            <MaterialIcons
              name="account-circle"
              size={72}
              color={THEME.COLORS.TEXT_DIM}
            />
            <Text style={styles.signedOutText}>{dict.ACCOUNT_SIGNED_OUT}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => navigation.navigate("Login")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {dict.ACCOUNT_SIGN_IN}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Background>
    );
  }

  const profileUser = profile?.user ?? user;
  const name = getUserName(profileUser);
  const banner = profile?.banner;
  const loginProvider = profile?.session.loginProvider;
  const bannerSource = buildAuthImageSource(
    banner?.url,
    user.sessionToken,
    `banner-${imageVersion}`,
  );

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        {renderHeader()}
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View
              style={[
                styles.banner,
                { backgroundColor: banner?.color ?? THEME.COLORS.FRAME },
              ]}
            >
              {bannerSource && (
                <Image source={bannerSource} style={styles.bannerImage} />
              )}
            </View>
            <View style={styles.identity}>
              <View style={styles.avatarWrap}>
                <Avatar uri={user.avatarUrl} size={AVATAR} />
              </View>
              <View style={styles.identityInfo}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {profileUser.email && (
                  <Text style={styles.caption} numberOfLines={1}>
                    {profileUser.email}
                  </Text>
                )}
                <View style={styles.badges}>
                  <View
                    style={[
                      styles.badge,
                      profileUser.verified
                        ? styles.badgeSuccess
                        : styles.badgeMuted,
                    ]}
                  >
                    <MaterialIcons
                      name={profileUser.verified ? "verified" : "info"}
                      size={13}
                      color={
                        profileUser.verified
                          ? THEME.COLORS.BRAND
                          : THEME.COLORS.TEXT_DIM
                      }
                    />
                    <Text
                      style={[
                        styles.badgeText,
                        profileUser.verified && styles.badgeTextSuccess,
                      ]}
                    >
                      {profileUser.verified
                        ? dict.ACCOUNT_VERIFIED
                        : dict.ACCOUNT_NOT_VERIFIED}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.verifiedInfo}>
              {profileUser.verified
                ? dict.ACCOUNT_VERIFIED_INFO_OK
                : dict.ACCOUNT_VERIFIED_INFO}
            </Text>

            <View style={styles.meta}>
              {loginProvider && (
                <View style={styles.metaRow}>
                  <ProviderIcon
                    provider={loginProvider}
                    size={16}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                  <Text style={styles.metaText}>
                    {dict.ACCOUNT_CONNECTED_VIA}{" "}
                    {providerLabel(loginProvider)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={!!busy}
            onPress={() =>
              handle("refresh", async () => {
                await refreshProfile();
                toast(dict.ACCOUNT_REFRESHED);
              })
            }
            style={styles.refreshRow}
          >
            {busy === "refresh" ? (
              <ActivityIndicator color={THEME.COLORS.TEXT} />
            ) : (
              <MaterialIcons
                name="sync"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT}
              />
            )}
            <Text style={styles.refreshText}>{dict.ACCOUNT_REFRESH}</Text>
          </TouchableOpacity>

          <SectionTitle
            title={dict.ACCOUNT_LINKED_ACCOUNTS}
            icon="link"
          />
          <View style={styles.group}>
            {availableProviders.map((provider, index) => {
              const linkedInfo = linkedProviders.find(
                (entry) => entry.provider === provider.name,
              );
              const linked = !!linkedInfo;
              const configured = isProviderConfigured(provider.name);
              const linkable = isProviderLinkable(provider.name);
              const rowBusy = busy === `link-${provider.name}`;
              return (
                <View key={provider.name}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <View style={styles.rowIcon}>
                      <ProviderIcon provider={provider.name} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel}>{provider.label}</Text>
                      <Text style={styles.rowCaption} numberOfLines={1}>
                        {linkedInfo
                          ? linkedProviderDetail(linkedInfo) ??
                            dict.ACCOUNT_LINKED
                          : dict.ACCOUNT_NOT_LINKED}
                      </Text>
                    </View>
                    {rowBusy ? (
                      <ActivityIndicator color={THEME.COLORS.TEXT} />
                    ) : linked ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={!canUnlink || !!busy}
                        activeOpacity={0.7}
                        onPress={() =>
                          handle(`link-${provider.name}`, async () => {
                            await unlinkProvider(provider.name);
                            toast(dict.ACCOUNT_UNLINK_SUCCESS);
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.rowAction,
                            (!canUnlink || !!busy) && styles.rowActionDisabled,
                          ]}
                        >
                          {dict.ACCOUNT_UNLINK}
                        </Text>
                      </TouchableOpacity>
                    ) : configured && linkable ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={!!busy}
                        activeOpacity={0.7}
                        onPress={() =>
                          handle(`link-${provider.name}`, async () => {
                            await linkProvider(provider.name);
                            toast(dict.ACCOUNT_LINK_SUCCESS);
                          })
                        }
                      >
                        <Text style={styles.rowAction}>
                          {dict.ACCOUNT_LINK}
                        </Text>
                      </TouchableOpacity>
                    ) : !configured ? (
                      <Text style={styles.soon}>
                        {dict.LOGIN_PROVIDER_UNAVAILABLE}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <SectionTitle title={dict.ACCOUNT_ANIMU_CONNECT} icon="vpn-key" />
          <View style={styles.group}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => setConnectVisible(true)}
              style={styles.row}
            >
              <View style={styles.rowIcon}>
                <ProviderIcon provider="animu" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>
                  {dict.ACCOUNT_ANIMU_CONNECT}
                </Text>
                <Text style={styles.rowCaption}>
                  {credentialsSet
                    ? credentialsUsername
                      ? dict.ACCOUNT_ANIMU_CONNECT_READY_AS.replace(
                          "{username}",
                          credentialsUsername,
                        )
                      : dict.ACCOUNT_ANIMU_CONNECT_READY
                    : dict.ACCOUNT_ANIMU_CONNECT_DESC}
                </Text>
              </View>
              <Text style={styles.rowAction}>
                {credentialsSet
                  ? dict.ACCOUNT_ANIMU_CONNECT_UPDATE
                  : dict.ACCOUNT_ANIMU_CONNECT_SETUP}
              </Text>
            </TouchableOpacity>
          </View>

          <SectionTitle title={dict.ACCOUNT_DANGER} icon="warning" />
          <View style={styles.group}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => void handle("logout", logout)}
              style={styles.row}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons
                  name="logout"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.ERROR}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, styles.dangerText]}>
                  {dict.ACCOUNT_LOGOUT}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={confirmDelete}
              style={styles.row}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons
                  name="delete-forever"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.ERROR}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, styles.dangerText]}>
                  {dict.ACCOUNT_DELETE}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <AnimuConnectSheet
          visible={connectVisible}
          onClose={() => setConnectVisible(false)}
          hasCredentials={credentialsSet === true}
        />
      </SafeAreaView>
    </Background>
  );
}
