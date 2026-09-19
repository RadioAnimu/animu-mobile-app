import { useEffect, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image, type ImageSource } from "expo-image";
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
import { MaskedValue } from "../../components/MaskedValue";
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
import { maskEmail, maskHandle, maskIdentifier } from "../../utils/mask";
import { DICT } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { AVATAR, HEADER_HEIGHT, styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

interface ProviderDisplay {
  /** The real detail line, shown while revealed. */
  value: string;
  /** The same line with the personal half masked. */
  masked: string;
}

/**
 * Identity line for a linked provider. Discord shows its `@handle` (or the
 * numeric id); Google/Apple show `name · email`. Each variant carries a
 * masked twin so the row protects the personal half by default.
 */
function providerDisplay(provider: LinkedProvider): ProviderDisplay | null {
  const handle = provider.providerUsername;

  if (provider.provider === "discord") {
    if (handle) return { value: `@${handle}`, masked: maskHandle(handle) };
    if (provider.providerUserId) {
      return {
        value: provider.providerUserId,
        masked: maskIdentifier(provider.providerUserId),
      };
    }
    return null;
  }

  const parts: string[] = [];
  const maskedParts: string[] = [];
  if (provider.providerName) {
    parts.push(provider.providerName);
    maskedParts.push(provider.providerName);
  }
  if (provider.providerEmail) {
    parts.push(provider.providerEmail);
    maskedParts.push(maskEmail(provider.providerEmail));
  }
  if (parts.length > 0) {
    return { value: parts.join(" · "), masked: maskedParts.join(" · ") };
  }
  if (handle) return { value: `@${handle}`, masked: maskHandle(handle) };
  if (provider.providerUserId) {
    return {
      value: provider.providerUserId,
      masked: maskIdentifier(provider.providerUserId),
    };
  }
  return null;
}

/** Transient banner failures self-heal, mirroring the `Avatar` component. */
const BANNER_RETRY_DELAY_MS = 3000;
const BANNER_MAX_RETRIES = 2;

interface ProfileBannerProps {
  source: ImageSource | undefined;
  /** The provider accent shown while the image loads or after it fails. */
  fallbackColor: string;
  /**
   * Bumped when the underlying profile media changes (imageVersion), so a
   * fresh banner re-enters the retry loop instead of sticking on a failed
   * frame.
   */
  revision: string | number;
}

/**
 * The profile banner, with the same never-blank contract as `Avatar`:
 * the colored fallback always renders underneath, the image fades in on
 * top, and a bounded retry loop re-attempts transient network/401 failures
 * instead of leaving an empty strip. If every attempt fails the strip
 * simply stays the accent color — the layout never collapses.
 */
function ProfileBanner({ source, fallbackColor, revision }: ProfileBannerProps) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);

  // Adjust state during render so a new image never flashes a stale frame.
  const [trackedRevision, setTrackedRevision] = useState(revision);
  if (trackedRevision !== revision) {
    setTrackedRevision(revision);
    setFailed(false);
    setRetry(0);
  }

  useEffect(() => {
    if (!failed || retry >= BANNER_MAX_RETRIES) return;
    const timer = setTimeout(() => {
      setFailed(false);
      setRetry((value) => value + 1);
    }, BANNER_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [failed, retry]);

  return (
    <View style={[styles.banner, { backgroundColor: fallbackColor }]}>
      {source && !failed && (
        <Image
          source={source}
          style={styles.bannerImage}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
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
    emails,
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

  // At least one social provider must always remain (Animu Connect does not
  // replace it) — the server refuses the last unlink with `last_provider`.
  const canUnlink = linkedProviders.length > 1;

  const animuConnectEmail =
    emails.find((email) => email.source === "animu")?.email ?? null;

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
            <ProfileBanner
              source={bannerSource}
              fallbackColor={banner?.color ?? THEME.COLORS.FRAME}
              revision={imageVersion}
            />
            <View style={styles.identity}>
              <View style={styles.avatarWrap}>
                <Avatar uri={user.avatarUrl} size={AVATAR} />
              </View>
              <View style={styles.identityInfo}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {profileUser.email && (
                  <MaskedValue
                    value={profileUser.email}
                    mask={maskEmail}
                    textStyle={styles.caption}
                    showLabel={dict.ACCOUNT_SHOW}
                    hideLabel={dict.ACCOUNT_HIDE}
                  />
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

          <SectionTitle title={dict.ACCOUNT_LINKED_ACCOUNTS} icon="link" />
          <View style={styles.group}>
            {availableProviders.map((provider, index) => {
              const linkedInfo = linkedProviders.find(
                (entry) => entry.provider === provider.name,
              );
              const linked = !!linkedInfo;
              const configured = isProviderConfigured(provider.name);
              const linkable = isProviderLinkable(provider.name);
              const rowBusy = busy === `link-${provider.name}`;
              const display = linkedInfo ? providerDisplay(linkedInfo) : null;
              return (
                <View key={provider.name}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <View style={styles.rowIcon}>
                      <ProviderIcon provider={provider.name} />
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
                          {linked
                            ? dict.ACCOUNT_LINKED
                            : dict.ACCOUNT_NOT_LINKED}
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
                        onPress={() =>
                          handle(`link-${provider.name}`, async () => {
                            await unlinkProvider(provider.name);
                            toast(dict.ACCOUNT_UNLINK_SUCCESS);
                          })
                        }
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
                    ) : configured && linkable ? (
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
                        onPress={() =>
                          handle(`link-${provider.name}`, async () => {
                            await linkProvider(provider.name);
                            toast(dict.ACCOUNT_LINK_SUCCESS);
                          })
                        }
                      >
                        <MaterialIcons
                          name="add-link"
                          size={THEME.ICON.MD}
                          color={THEME.COLORS.BRAND}
                        />
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
                <ProviderIcon provider="animu" size={18} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>
                  {dict.ACCOUNT_ANIMU_CONNECT}
                </Text>
                <Text style={styles.rowCaption}>
                  {animuConnectEmail
                    ? dict.ACCOUNT_ANIMU_CONNECT_READY_AS.replace(
                        "{email}",
                        animuConnectEmail,
                      )
                    : dict.ACCOUNT_ANIMU_CONNECT_DESC}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_DIM}
              />
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
        />
      </SafeAreaView>
    </Background>
  );
}
