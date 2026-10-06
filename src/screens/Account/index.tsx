import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimuApiError } from "animu-api";
import { AccountEmails } from "@/components/AccountEmails";
import { AppRefreshControl } from "@/components/AppRefreshControl";
import { DestructiveAction } from "@/components/DestructiveAction";
import { ActionRow } from "@/components/ListRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { useScrollEndPadding } from "@/hooks/useScrollEndPadding";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { AuthFlowCancelled } from "@/core/auth";
import { haptics } from "@/utils/haptics";
import { interpolate } from "@/utils/format";
import type { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { styles } from "@/screens/Account/styles";
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

  // Animu Connect's add-email form is inline in this scroll view, so the
  // screen owns the keyboard inset (Android edge-to-edge; iOS handles it
  // through `automaticallyAdjustKeyboardInsets` below).
  const keyboardPadding = useKeyboardPadding(Platform.OS === "android");

  const [busy, setBusy] = useState<string | null>(null);

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

  // At least one social provider must always remain (Animu Connect does not
  // replace it) — the server refuses the last unlink with `last_provider`.
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
            haptics.warning();
            void handle("delete", async () => {
              await deleteAccount();
              navigation.navigate("Main", { screen: "Home" });
            });
          },
        },
      ],
    );
  };

  const confirmUnlink = (name: string) => {
    const provider =
      providers.find((entry) => entry.name === name)?.label ?? name;
    Alert.alert(
      interpolate(dict.ACCOUNT_UNLINK_CONFIRM_TITLE, { provider }),
      interpolate(dict.ACCOUNT_UNLINK_CONFIRM_MSG, { provider }),
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

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={["left", "right"]}
      >
        {renderHeader()}
        <View style={styles.signedOut}>
          <Icon
            name="account-circle"
            size={THEME.ICON.XL * 2}
            color={THEME.COLORS.TEXT_DIM}
          />
          <Text style={styles.signedOutText}>{dict.ACCOUNT_SIGNED_OUT}</Text>
          <PrimaryButton
            label={dict.ACCOUNT_SIGN_IN}
            icon="login"
            onPress={() => navigation.navigate("Login")}
            style={styles.signedOutAction}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {renderHeader()}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: endPadding + keyboardPadding },
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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

        <LinkedAccounts
          providers={providers}
          linkedProviders={linkedProviders}
          canUnlink={canUnlink}
          busy={busy}
          onLink={(provider) =>
            handle(`link-${provider}`, async () => {
              await linkProvider(provider);
              haptics.success();
              toast(dict.ACCOUNT_LINK_SUCCESS);
            })
          }
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
            busy={busy === "logout"}
            onPress={() =>
              void handle("logout", async () => {
                await logout();
                // Swap the now-empty account page for sign-in, so back
                // returns to Settings instead of a signed-out Account.
                navigation.replace("Login");
              })
            }
          />
        </View>

        <SectionTitle title={dict.ACCOUNT_DANGER} icon="warning" />
        <DestructiveAction
          icon="delete-forever"
          label={dict.ACCOUNT_DELETE}
          busy={busy === "delete"}
          onPress={confirmDelete}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
