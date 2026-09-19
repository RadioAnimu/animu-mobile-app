import { useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimuApiError } from "animu-api";
import { Background } from "@/components/Background";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { AuthFlowCancelled } from "@/core/auth";
import { isProviderConfigured } from "@/constants/auth";
import { useDict } from "@/hooks/useDict";
import { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { styles } from "@/screens/Login/styles";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type Step = "method" | "connect";
type ConnectStep = "email" | "code";

const TOTAL_STEPS = 2;

export function Login({ navigation }: Props) {
  const { toast, error: showError } = useAlert();
  const {
    providers,
    loginWithProvider,
    requestEmailLoginCode,
    loginWithEmailCode,
    isAuthenticating,
  } = useAuth();
  const dict = useDict();

  const [step, setStep] = useState<Step>("method");
  const [connectStep, setConnectStep] = useState<ConnectStep>("email");
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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

  const handleSendCode = async () => {
    if (isAuthenticating) return;
    const address = email.trim();
    if (!address) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setError(null);
    setBusyProvider("animu");
    try {
      await requestEmailLoginCode(address);
      setEmail(address);
      setConnectStep("code");
      toast(dict.LOGIN_CODE_SENT);
    } catch {
      setError(dict.LOGIN_FAILED);
    } finally {
      setBusyProvider(null);
    }
  };

  const handleVerifyCode = async () => {
    if (isAuthenticating) return;
    const value = code.trim();
    if (!value) {
      setError(dict.LOGIN_MISSING_FIELDS);
      return;
    }
    setError(null);
    setBusyProvider("animu");
    try {
      await loginWithEmailCode(email.trim(), value);
      toast(dict.LOGIN_SUCCESS);
      finish();
    } catch (err) {
      setError(
        err instanceof AnimuApiError && err.code === "email_code_failed"
          ? dict.LOGIN_CODE_INVALID
          : dict.LOGIN_FAILED,
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const goBack = () => {
    if (step === "connect") {
      if (connectStep === "code") {
        setConnectStep("email");
        setCode("");
        setError(null);
        return;
      }
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
        <ScreenHeader title={dict.LOGIN_TITLE} onBack={goBack} />

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
              <Text style={styles.subtitle}>
                {connectStep === "email"
                  ? dict.LOGIN_CONNECT_SUBTITLE
                  : dict.LOGIN_CODE_SUBTITLE.replace("{email}", email.trim())}
              </Text>

              {connectStep === "email" ? (
                <View style={styles.form}>
                  <Text style={styles.fieldLabel}>{dict.LOGIN_EMAIL}</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isAuthenticating}
                    placeholder={dict.LOGIN_EMAIL_PLACEHOLDER}
                    placeholderTextColor={THEME.COLORS.TEXT_DIM}
                    onSubmitEditing={handleSendCode}
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <Text style={styles.fieldLabel}>{dict.LOGIN_CODE}</Text>
                  <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={6}
                    editable={!isAuthenticating}
                    placeholder={dict.LOGIN_CODE_PLACEHOLDER}
                    placeholderTextColor={THEME.COLORS.TEXT_DIM}
                    onSubmitEditing={handleVerifyCode}
                  />
                </View>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={isAuthenticating}
                onPress={connectStep === "email" ? handleSendCode : handleVerifyCode}
                style={[
                  styles.submit,
                  isAuthenticating && styles.submitDisabled,
                ]}
              >
                {isAuthenticating ? (
                  <ActivityIndicator color={THEME.COLORS.TEXT} />
                ) : (
                  <Text style={styles.submitText}>
                    {connectStep === "email"
                      ? dict.LOGIN_SEND_CODE
                      : dict.LOGIN_BUTTON}
                  </Text>
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
