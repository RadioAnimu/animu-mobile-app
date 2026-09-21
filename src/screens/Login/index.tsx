import { useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { DrawerScreenProps } from "@react-navigation/drawer";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Background } from "@/components/Background";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { AuthFlowCancelled } from "@/core/auth";
import { isProviderConfigured } from "@/constants/auth";
import type { Dict } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import { useEmailCodeFlow, emailCodeError } from "@/hooks/useEmailCodeFlow";
import { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { styles } from "@/screens/Login/styles";

type Props = DrawerScreenProps<RootStackParamList, "Login">;
type Step = "method" | "connect";

const TOTAL_STEPS = 2;

interface CodeActionsProps {
  dict: Dict;
  busy: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}

/** Resend / change-email shortcuts shown once the code step is reached. */
function CodeActions({ dict, busy, onResend, onChangeEmail }: CodeActionsProps) {
  return (
    <View style={styles.codeActions}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={busy}
        onPress={onResend}
      >
        <Text style={[styles.link, busy && styles.linkDisabled]}>
          {dict.LOGIN_CODE_RESEND}
        </Text>
      </TouchableOpacity>
      <Text style={styles.linkDot}>•</Text>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={busy}
        onPress={onChangeEmail}
      >
        <Text style={[styles.link, busy && styles.linkDisabled]}>
          {dict.LOGIN_CODE_CHANGE_EMAIL}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

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
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const finish = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home");
    }
  };

  const flow = useEmailCodeFlow({
    requestCode: requestEmailLoginCode,
    verifyCode: loginWithEmailCode,
    onCodeSent: () => toast(dict.LOGIN_CODE_SENT),
    onVerified: () => {
      toast(dict.LOGIN_SUCCESS);
      finish();
    },
    mapRequestError: () => dict.LOGIN_FAILED,
    mapVerifyError: (error) => emailCodeError(dict, error, dict.LOGIN_FAILED),
  });

  const handleProvider = async (provider: string) => {
    if (isAuthenticating || busyProvider) return;
    setProviderError(null);
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
        setProviderError(dict.LOGIN_FAILED);
        showError(dict.LOGIN_FAILED);
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const goBack = () => {
    if (step === "connect") {
      if (flow.step === "code") {
        flow.backToEmail();
        return;
      }
      setStep("method");
      setProviderError(null);
      flow.setError(null);
      return;
    }
    navigation.goBack();
  };

  const stepIndex = step === "method" ? 1 : 2;
  const errorMessage = providerError ?? flow.error;

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
              <Text style={styles.lead}>{dict.LOGIN_SUBTITLE}</Text>

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
                  setProviderError(null);
                  flow.setError(null);
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
                {flow.step === "email"
                  ? dict.LOGIN_CONNECT_SUBTITLE
                  : dict.LOGIN_CODE_SUBTITLE.replace(
                      "{email}",
                      flow.email.trim(),
                    )}
              </Text>

              <View style={styles.form}>
                <EmailCodeFields flow={flow} />
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={flow.busy}
                onPress={flow.step === "email" ? flow.sendCode : flow.verify}
                style={[
                  styles.submit,
                  flow.busy && styles.submitDisabled,
                ]}
              >
                {flow.busy ? (
                  <ActivityIndicator color={THEME.COLORS.TEXT} />
                ) : (
                  <Text style={styles.submitText}>
                    {flow.step === "email"
                      ? dict.LOGIN_SEND_CODE
                      : dict.LOGIN_BUTTON}
                  </Text>
                )}
              </TouchableOpacity>

              {flow.step === "code" && (
                <CodeActions
                  dict={dict}
                  busy={flow.busy}
                  onResend={() => void flow.sendCode()}
                  onChangeEmail={flow.backToEmail}
                />
              )}
            </>
          )}

          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
