import { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Background } from "../../components/Background";
import { BackArrow } from "../../components/BackArrow";
import { ProviderIcon } from "../../components/ProviderIcon";
import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { AuthFlowCancelled } from "../../core/auth";
import { isProviderConfigured } from "../../constants/auth";
import { DICT } from "../../i18n";
import { RootStackParamList } from "../../routes/app.routes";
import { THEME } from "../../theme";
import { HEADER_HEIGHT, styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type Step = "method" | "connect";

const TOTAL_STEPS = 2;

export function Login({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { settings } = useUserSettings();
  const { toast, error: showError } = useAlert();
  const {
    providers,
    loginWithProvider,
    loginWithAnimuConnect,
    isAuthenticating,
  } = useAuth();
  const dict = DICT[settings.selectedLanguage];

  const [step, setStep] = useState<Step>("method");
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home");
    }
  };

  const handleProvider = async (provider: string) => {
    if (isAuthenticating || busyProvider) return;
    setError(null);
    setBusyProvider(provider);
    try {
      await loginWithProvider(provider);
      toast(dict.LOGIN_SUCCESS);
      finish();
    } catch (err) {
      if (err instanceof AuthFlowCancelled) {
        // User dismissed the prompt — not worth an error.
      } else {
        console.error(`[Login] ${provider} sign-in failed:`, err);
        setError(dict.LOGIN_FAILED);
        showError(dict.LOGIN_FAILED);
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const handleConnect = async () => {
    if (isAuthenticating) return;
    if (!username.trim() || !password) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setError(null);
    setBusyProvider("animu");
    try {
      await loginWithAnimuConnect(username.trim(), password);
      toast(dict.LOGIN_SUCCESS);
      finish();
    } catch {
      setError(dict.LOGIN_FAILED);
    } finally {
      setBusyProvider(null);
    }
  };

  const goBack = () => {
    if (step === "connect") {
      setStep("method");
      setError(null);
      return;
    }
    navigation.goBack();
  };

  const stepIndex = step === "method" ? 1 : 2;

  return (
    <Background>
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View
          style={[
            styles.header,
            { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top },
          ]}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            style={styles.headerButton}
          >
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{dict.LOGIN_TITLE}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepper}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.stepDot,
                  index < stepIndex && styles.stepDotActive,
                ]}
              />
            ))}
          </View>

          {step === "method" ? (
            <>
              <Text style={styles.title}>{dict.LOGIN_TITLE}</Text>
              <Text style={styles.subtitle}>{dict.LOGIN_SUBTITLE}</Text>

              <View style={styles.methods}>
                {providers.map((provider) => {
                  const configured = isProviderConfigured(provider.name);
                  const busy = busyProvider === provider.name;
                  return (
                    <TouchableOpacity
                      key={provider.name}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !configured }}
                      activeOpacity={0.7}
                      disabled={!configured || isAuthenticating}
                      onPress={() => handleProvider(provider.name)}
                      style={[
                        styles.method,
                        !configured && styles.methodDisabled,
                      ]}
                    >
                      <View style={styles.methodIcon}>
                        <ProviderIcon
                          provider={provider.name}
                          size={THEME.ICON.LG}
                        />
                      </View>
                      <Text style={styles.methodLabel}>{provider.label}</Text>
                      {busy ? (
                        <ActivityIndicator color={THEME.COLORS.TEXT} />
                      ) : configured ? (
                        <MaterialIcons
                          name="chevron-right"
                          size={THEME.ICON.MD}
                          color={THEME.COLORS.TEXT_DIM}
                        />
                      ) : (
                        <Text style={styles.soon}>
                          {dict.LOGIN_PROVIDER_UNAVAILABLE}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{dict.LOGIN_OR}</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={isAuthenticating}
                onPress={() => {
                  setError(null);
                  setStep("connect");
                }}
                style={styles.method}
              >
                <View style={styles.methodIcon}>
                  <ProviderIcon provider="animu" size={THEME.ICON.LG} />
                </View>
                <Text style={styles.methodLabel}>
                  {dict.LOGIN_WITH_ANIMU_CONNECT}
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT_DIM}
                />
              </TouchableOpacity>

              <Text style={styles.hint}>
                {dict.LOGIN_ANIMU_CONNECT_HINT}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>{dict.LOGIN_WITH_ANIMU_CONNECT}</Text>
              <Text style={styles.subtitle}>{dict.LOGIN_CONNECT_SUBTITLE}</Text>

              <View style={styles.form}>
                <Text style={styles.fieldLabel}>{dict.LOGIN_USERNAME}</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isAuthenticating}
                  placeholder={dict.LOGIN_USERNAME_PLACEHOLDER}
                  placeholderTextColor={THEME.COLORS.TEXT_DIM}
                />

                <Text style={styles.fieldLabel}>{dict.LOGIN_PASSWORD}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!isAuthenticating}
                  placeholder={dict.LOGIN_PASSWORD_PLACEHOLDER}
                  placeholderTextColor={THEME.COLORS.TEXT_DIM}
                  onSubmitEditing={handleConnect}
                />
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={isAuthenticating}
                onPress={handleConnect}
                style={[
                  styles.submit,
                  isAuthenticating && styles.submitDisabled,
                ]}
              >
                {isAuthenticating ? (
                  <ActivityIndicator color={THEME.COLORS.TEXT} />
                ) : (
                  <Text style={styles.submitText}>{dict.LOGIN_BUTTON}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
