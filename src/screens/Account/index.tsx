import { useEffect, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimuApiError } from "animu-api";
import { AccountEmails } from "@/components/AccountEmails";
import { AppRefreshControl } from "@/components/AppRefreshControl";
import { DestructiveAction } from "@/components/DestructiveAction";
import { KeyboardScrollView } from "@/components/KeyboardScrollView";
import { ActionRow } from "@/components/ListRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import { AuthFlowCancelled, ProviderLinkConflict } from "@/core/auth";
import { haptics } from "@/utils/haptics";
import { interpolate } from "@/utils/format";
import type { RootStackParamList } from "@/routes/app.routes";
import { styles } from "@/screens/Account/styles";
import { RequestsStatus } from "@/screens/Account/RequestsStatus";
import { LinkedAccounts } from "@/screens/Account/LinkedAccounts";
import { ProfileCard } from "@/screens/Account/ProfileCard";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

export function Account({ navigation }: Readonly<Props>) {
  const { toast, error: showError } = useAlert();
  const {
    user,
    profile,
    providers,
    isAuthenticated,
    imageVersion,
    media,
    logout,
    deleteAccount,
    refreshProfile,
    linkProvider,
    unlinkProvider,
  } = useAuth();
  const dict = useDict();
  const endPadding = useScrollEndPadding();

  const [busy, setBusy] = useState<string | null>(null);
  // Set when log out / delete navigate away themselves, so the lost-session
  // redirect below doesn't fire a second navigation behind them.
  const leavingRef = useRef(false);

  const labelOf = (name: string) =>
    providers.find((entry) => entry.name === name)?.label ?? name;

  const handle = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (error) {
      if (error instanceof AuthFlowCancelled) {
        // User dismissed the OAuth prompt — not worth an error.
      } else if (error instanceof ProviderLinkConflict) {
        // That identity belongs to another Animu account; retrying can't help.
        showError(
          interpolate(dict.ACCOUNT_LINK_CONFLICT, {
            provider: labelOf(error.provider),
          }),
        );
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

  // At least one social provider must always remain (Animu Connect does not
  // replace it) — the server refuses the last unlink with `last_provider`.
  const canUnlink = linkedProviders.length > 1;

  const link = (provider: string) =>
    handle(`link-${provider}`, async () => {
      await linkProvider(provider);
      haptics.success();
      toast(dict.ACCOUNT_LINK_SUCCESS);
    });

  // The refresh row re-runs the server's verification check (e.g. after the
  // user turned on Discord 2FA) and reports what it found.
  const checkRequests = () =>
    handle("requests-refresh", async () => {
      const fresh = await refreshProfile();
      if (fresh?.user.verified) {
        haptics.success();
        toast(dict.ACCOUNT_REQUESTS_NOW_ON);
      } else {
        toast(dict.ACCOUNT_REQUESTS_STILL_OFF, "info");
      }
    });

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
            haptics.warning();
            void handle("delete", async () => {
              await deleteAccount();
              leavingRef.current = true;
              navigation.navigate("Main", { screen: "Home" });
            });
          },
        },
      ],
    );
  };

  const confirmUnlink = (name: string) => {
    const provider = labelOf(name);
    // Discord is what verifies the account, so unlinking it also ends song
    // requests — say so before the user confirms.
    const warning =
      name === "discord" && profile?.user.verified
        ? `\n\n${dict.ACCOUNT_UNLINK_DISCORD_WARNING}`
        : "";
    Alert.alert(
      interpolate(dict.ACCOUNT_UNLINK_CONFIRM_TITLE, { provider }),
      interpolate(dict.ACCOUNT_UNLINK_CONFIRM_MSG, { provider }) + warning,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.ACCOUNT_UNLINK,
          style: "destructive",
          onPress: () => {
            void handle(`link-${name}`, async () => {
              await unlinkProvider(name);
              haptics.success();
              toast(dict.ACCOUNT_UNLINK_SUCCESS);
            });
          },
        },
      ],
    );
  };

  const renderHeader = () => (
    <ScreenHeader
      title={dict.ACCOUNT_TITLE}
      onBack={() => navigation.goBack()}
    />
  );

  const signedOut = !isAuthenticated || !user;

  // There is no signed-out Account page: losing the session here (it expired,
  // or was revoked elsewhere) swaps the page for sign-in, so back still
  // returns to Settings. Log out and delete navigate on their own: `busy`
  // holds this off while they run, and `leavingRef` once they have left.
  useEffect(() => {
    if (signedOut && busy === null && !leavingRef.current) {
      navigation.replace("Login");
    }
  }, [signedOut, busy, navigation]);

  if (signedOut) {
    // One frame before the replace lands: keep the header, skip the content.
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        {renderHeader()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {renderHeader()}
      {/* Animu Connect's add-email form is inline here: the keyboard-aware
          view keeps its field and the button under it above the keyboard. */}
      <KeyboardScrollView
        contentContainerStyle={[styles.content, { paddingBottom: endPadding }]}
        refreshControl={
          <AppRefreshControl
            refreshing={busy === "refresh"}
            onRefresh={() =>
              void handle("refresh", async () => {
                await refreshProfile();
                toast(dict.ACCOUNT_REFRESHED);
              })
            }
          />
        }
      >
        <ProfileCard
          user={user}
          profile={profile}
          imageVersion={imageVersion}
          bannerUri={media.banner}
        />

        <RequestsStatus
          profile={profile}
          busy={busy}
          onLinkDiscord={() => void link("discord")}
          onRefresh={() => void checkRequests()}
        />

        <LinkedAccounts
          providers={providers}
          linkedProviders={linkedProviders}
          canUnlink={canUnlink}
          busy={busy}
          onLink={link}
          onUnlink={confirmUnlink}
        />

        <SectionTitle
          title={dict.ACCOUNT_ANIMU_CONNECT}
          icon="alternate-email"
        />
        <Text style={styles.sectionHint}>
          {dict.ACCOUNT_ANIMU_CONNECT_DESC}
        </Text>
        <View style={styles.group}>
          <AccountEmails />
        </View>

        {/* Signing out is routine and reversible — a plain row, not a danger. */}
        <View style={styles.groupSpaced}>
          <ActionRow
            icon="logout"
            label={dict.ACCOUNT_LOGOUT}
            description={dict.ACCOUNT_LOGOUT_DESC}
            busy={busy === "logout"}
            // Account actions run one at a time: show the others as blocked
            // instead of letting a tap silently do nothing.
            disabled={busy !== null}
            onPress={() =>
              void handle("logout", async () => {
                await logout();
                // Swap the now-empty account page for sign-in, so back
                // returns to Settings instead of a signed-out Account.
                leavingRef.current = true;
                navigation.replace("Login");
              })
            }
          />
        </View>

        <SectionTitle title={dict.ACCOUNT_DANGER} icon="warning" />
        <DestructiveAction
          icon="delete-forever"
          label={dict.ACCOUNT_DELETE}
          description={dict.ACCOUNT_DELETE_DESC}
          busy={busy === "delete"}
          disabled={busy !== null}
          onPress={confirmDelete}
        />
      </KeyboardScrollView>
    </SafeAreaView>
  );
}
