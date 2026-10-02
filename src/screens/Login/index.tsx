import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderInfo } from "animu-api";

import { API } from "@/api";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { Background } from "@/components/Background";
import { BackArrow } from "@/components/BackArrow";
import { CodeSubtitle } from "@/components/CodeSubtitle";
import { ConnectActions } from "@/components/ConnectActions";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { FormError } from "@/components/FormError";
import { Logo } from "@/components/Logo";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ProviderIcon } from "@/components/ProviderIcon";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { AuthFlowCancelled } from "@/core/auth";
import { isProviderConfigured } from "@/constants/auth";
import { RESEND_COOLDOWN_SECONDS } from "@/constants/email-code";
import type { Dict } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import {
  useEmailCodeFlow,
  emailCodeError,
  type EmailCodeFlow,
} from "@/hooks/useEmailCodeFlow";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { haptics } from "@/utils/haptics";
import { interpolate } from "@/utils/format";
import type { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { styles } from "@/screens/Login/styles";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type Step = "method" | "connect";

/** Gap between the entrance of consecutive blocks — a beat, not a wait. */
const ENTRANCE_STAGGER = 40;

/**
 * Fade-and-rise entrance for an auth block. Each section starts a beat after
 * the previous one so the screen assembles instead of popping in, while the
 * whole screen is settled in well under a third of a second. Reduce Motion
 * keeps the fade and drops the rise.
 */
function useEntrance(step = 0) {
  const [progress] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay: step * ENTRANCE_STAGGER,
      duration: MOTION.DURATION.NORMAL,
      easing: MOTION.EASING.ENTER,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, progress]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [reduceMotion ? 0 : MOTION.RISE, 0],
        }),
      },
    ],
  };
}

/** "By continuing, you agree to our <Privacy Policy>." — link inside the copy. */
function LegalLine({ dict }: { dict: Dict }) {
  const [before, after] = dict.LOGIN_LEGAL.split("{link}");

  return (
    <Text style={styles.legal}>
      {before}
      <Text
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(API.PRIVACY_URL).catch((error) =>
            console.warn("[Login] failed to open the privacy policy:", error),
          );
        }}
        style={styles.legalLink}
      >
        {dict.SETTINGS_PRIVACY_POLICY}
      </Text>
      {after}
    </Text>
  );
}

interface MethodStepProps {
  dict: Dict;
  providers: ProviderInfo[];
  busyProvider: string | null;
  authenticating: boolean;
  error: string | null;
  onProvider: (provider: string) => void;
  onConnect: () => void;
}

/**
 * Hero + sign-in methods: Animu Connect — the passwordless house method — is
 * the one filled brand button, its tagline says what it does, and the OAuth
 * providers follow as quiet outlined pills. The terms line ends the screen.
 */
function MethodStep({
  dict,
  providers,
  busyProvider,
  authenticating,
  error,
  onProvider,
  onConnect,
}: MethodStepProps) {
  const heroStyle = useEntrance(0);
  const connectStyle = useEntrance(1);
  const providersStyle = useEntrance(2);

  return (
    <>
      <Animated.View style={[styles.hero, heroStyle]}>
        <Logo size={THEME.LAYOUT.LOGO_HEIGHT} />
        <Text style={styles.headline}>{dict.LOGIN_HEADLINE}</Text>
        <Text style={styles.subtitle}>{dict.LOGIN_SUBTITLE}</Text>
      </Animated.View>

      <View style={styles.actions}>
        {error && (
          <View style={styles.errorSlot}>
            <FormError message={error} center />
          </View>
        )}

        <Animated.View style={connectStyle}>
          <PrimaryButton
            label={dict.LOGIN_WITH_ANIMU_CONNECT}
            icon="alternate-email"
            disabled={authenticating}
            onPress={onConnect}
          />
          <Text style={styles.tagline}>{dict.LOGIN_ANIMU_CONNECT_TAGLINE}</Text>
        </Animated.View>

        <Animated.View style={providersStyle}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{dict.LOGIN_OR_CONTINUE}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.methods}>
            {providers
              .filter((provider) => isProviderConfigured(provider.name))
              .map((provider) => {
                const busy = busyProvider === provider.name;
                const label = interpolate(dict.LOGIN_CONTINUE_WITH, {
                  provider: provider.label,
                });
                return (
                  <TouchableOpacity
                    key={provider.name}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ busy, disabled: authenticating }}
                    activeOpacity={THEME.OPACITY.PRESSED}
                    disabled={authenticating}
                    onPress={() => onProvider(provider.name)}
                    style={[
                      styles.method,
                      authenticating && styles.buttonDisabled,
                    ]}
                  >
                    <View style={styles.methodIcon}>
                      {busy ? (
                        <ActivityIndicator color={THEME.COLORS.TEXT} />
                      ) : (
                        <ProviderIcon
                          provider={provider.name}
                          size={THEME.ICON.MD}
                          color={THEME.COLORS.TEXT}
                        />
                      )}
                    </View>
                    <Text style={styles.methodLabel}>{label}</Text>
                    <View style={styles.methodIcon} />
                  </TouchableOpacity>
                );
              })}
          </View>
        </Animated.View>
      </View>

      <LegalLine dict={dict} />
    </>
  );
}

interface ConnectStepProps {
  dict: Dict;
  flow: EmailCodeFlow;
  error: string | null;
  resendRemaining: number;
  onResend: () => Promise<void>;
}

/** Animu Connect: the email form, then the 4-digit code form. */
function ConnectStep({
  dict,
  flow,
  error,
  resendRemaining,
  onResend,
}: ConnectStepProps) {
  const onCodeStep = flow.step === "code";
  const headerStyle = useEntrance(0);
  const formStyle = useEntrance(1);

  return (
    <View style={styles.connectBody}>
      <Animated.View style={[styles.connectHeader, headerStyle]}>
        <View style={styles.connectBadge}>
          <Icon
            name={onCodeStep ? "mark-email-unread" : "alternate-email"}
            size={THEME.ICON.XL}
            color={THEME.COLORS.BRAND}
          />
        </View>
        <Text style={styles.title}>
          {onCodeStep ? dict.LOGIN_CODE_TITLE : dict.LOGIN_CONNECT_TITLE}
        </Text>
        <Text style={styles.subtitle}>
          {onCodeStep ? (
            <CodeSubtitle
              template={dict.LOGIN_CODE_SUBTITLE}
              email={flow.email.trim()}
            />
          ) : (
            dict.LOGIN_CONNECT_SUBTITLE
          )}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.form, formStyle]}>
        <EmailCodeFields flow={flow} autoFocusEmail />

        {error && (
          <View style={styles.errorSlot}>
            <FormError message={error} center />
          </View>
        )}

        {/* The email step's button carries its own spinner. */}
        {flow.busy && onCodeStep && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={THEME.COLORS.SPINNER} />
          </View>
        )}

        {onCodeStep && (
          <View style={styles.connectActions}>
            <ConnectActions
              busy={flow.busy}
              resendRemaining={resendRemaining}
              onResend={() => void onResend()}
              onChangeEmail={flow.backToEmail}
            />
          </View>
        )}
      </Animated.View>

      {!onCodeStep && (
        <Text style={styles.hint}>{dict.LOGIN_ANIMU_CONNECT_HINT}</Text>
      )}
    </View>
  );
}

/**
 * Sign-in screen: a branded hero over the app artwork (localized wordmark,
 * welcome headline) with the OAuth providers and Animu Connect as sign-in
 * options. The connect step swaps the hero for a centered form: email first,
 * then the 4-digit code.
 */
export function Login({ navigation }: Props) {
  const { toast } = useAlert();
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
  const resend = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  // Android edge-to-edge draws behind the software keyboard, so the bottom
  // form would stay hidden while typing; iOS is covered by the scroll view's
  // `automaticallyAdjustKeyboardInsets` below.
  const keyboardPadding = useKeyboardPadding(Platform.OS === "android");

  const finish = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Main", { screen: "Home" });
    }
  };

  const flow = useEmailCodeFlow({
    requestCode: requestEmailLoginCode,
    verifyCode: loginWithEmailCode,
    onCodeSent: () => {
      resend.start();
      toast(dict.LOGIN_CODE_SENT);
    },
    onVerified: () => {
      haptics.success();
      toast(dict.LOGIN_SUCCESS);
      finish();
    },
    mapRequestError: () => dict.LOGIN_FAILED,
    mapVerifyError: (error) => emailCodeError(dict, error, dict.LOGIN_FAILED),
  });

  const handleProvider = async (provider: string) => {
    if (isAuthenticating || busyProvider) return;
    haptics.tap();
    setProviderError(null);
    setBusyProvider(provider);
    try {
      await loginWithProvider(provider);
      haptics.success();
      toast(dict.LOGIN_SUCCESS);
      finish();
    } catch (err) {
      if (err instanceof AuthFlowCancelled) {
        // User dismissed the prompt — not worth an error.
      } else {
        console.error(`[Login] ${provider} sign-in failed:`, err);
        setProviderError(dict.LOGIN_FAILED);
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
    finish();
  };

  // While the connect form is up, the iOS edge swipe would pop the whole
  // screen and lose the step; the arrow and hardware back step out instead.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step === "method" });
  }, [navigation, step]);

  // Hardware back steps out of the connect form instead of leaving Login.
  const goBackRef = useRef(goBack);
  const stepRef = useRef(step);
  useEffect(() => {
    goBackRef.current = goBack;
    stepRef.current = step;
  });
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (stepRef.current !== "connect") return false;
          goBackRef.current();
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );

  const openConnect = () => {
    haptics.tap();
    setProviderError(null);
    flow.setError(null);
    setStep("connect");
  };

  const error = providerError ?? flow.error;

  return (
    // The stack scene is opaque, so the screen paints the app artwork itself.
    <Background>
      <AuthBackdrop />
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right", "bottom"]}
      >
        {/* Outside the scroll view so it stays reachable with the keyboard up. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_BACK}
            activeOpacity={THEME.OPACITY.PRESSED}
            hitSlop={THEME.HIT_SLOP.SM}
            onPress={goBack}
            style={styles.backButton}
          >
            <BackArrow />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            keyboardPadding > 0 && {
              paddingBottom: keyboardPadding + THEME.SPACE.XXXL,
            },
          ]}
          // iOS keeps the scroll view clear of the software keyboard so the
          // focused field scrolls into view (Android resizes the window).
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {step === "method" ? (
            <MethodStep
              dict={dict}
              providers={providers}
              busyProvider={busyProvider}
              authenticating={isAuthenticating}
              error={error}
              onProvider={handleProvider}
              onConnect={openConnect}
            />
          ) : (
            <ConnectStep
              dict={dict}
              flow={flow}
              error={error}
              resendRemaining={resend.remaining}
              onResend={flow.sendCode}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Background>
  );
}
