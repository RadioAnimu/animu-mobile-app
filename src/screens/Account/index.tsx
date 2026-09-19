import { useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { DrawerScreenProps } from "@react-navigation/drawer";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimuApiError } from "animu-api";
import { Background } from "@/components/Background";
import { AnimuConnectSheet } from "@/components/AnimuConnectSheet";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionTitle } from "@/components/SectionTitle";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { AuthFlowCancelled } from "@/core/auth";
import { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { styles } from "@/screens/Account/styles";
import { LinkedAccounts } from "@/screens/Account/LinkedAccounts";
import { ProfileCard } from "@/screens/Account/ProfileCard";

type Props = DrawerScreenProps<RootStackParamList, "Account">;

export function Account({ navigation }: Props) {
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
  const dict = useDict();

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
    <ScreenHeader
      title={dict.ACCOUNT_TITLE}
      onBack={() => navigation.goBack()}
    />
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

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        {renderHeader()}
        <ScrollView contentContainerStyle={styles.content}>
          <ProfileCard
            user={user}
            profile={profile}
            imageVersion={imageVersion}
          />

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

          <LinkedAccounts
            providers={providers}
            linkedProviders={linkedProviders}
            canUnlink={canUnlink}
            busy={busy}
            onLink={(provider) =>
              handle(`link-${provider}`, async () => {
                await linkProvider(provider);
                toast(dict.ACCOUNT_LINK_SUCCESS);
              })
            }
            onUnlink={(provider) =>
              handle(`link-${provider}`, async () => {
                await unlinkProvider(provider);
                toast(dict.ACCOUNT_UNLINK_SUCCESS);
              })
            }
          />

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
