import { useCallback, useEffect, useRef, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { DrawerScreenProps } from "@react-navigation/drawer";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { BackArrow } from "@/components/BackArrow";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { Logo } from "@/components/Logo";
import { ProviderIcon } from "@/components/ProviderIcon";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { AuthFlowCancelled } from "@/core/auth";
import { isProviderConfigured } from "@/constants/auth";
import type { Dict } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import {
  useEmailCodeFlow,
  emailCodeError,
  type EmailCodeFlow,
} from "@/hooks/useEmailCodeFlow";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { haptics } from "@/utils/haptics";
import { interpolate } from "@/utils/format";
import { RootStackParamList } from "@/routes/app.routes";
import { scale } from "@/theme/responsive";
import { THEME } from "@/theme";
import { styles } from "@/screens/Login/styles";

type Props = DrawerScreenProps<RootStackParamList, "Login">;
type Step = "method" | "connect";

/** Localized wordmark height in the hero. */
const LOGO_HEIGHT = scale(96);
/** Resend lockout after a code is sent. */
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Fade-and-rise entrance for an auth block. Each section starts a beat after
 * the previous one so the screen assembles instead of popping in.
 */
function useEntrance(delay = 0) {
  const progressRef = useRef<Animated.Value | null>(null);
  if (progressRef.current === null) progressRef.current = new Animated.Value(0);
  const progress = progressRef.current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [scale(14), 0],
        }),
      },
    ],
  };
}

/** Counts down a resend lockout; `start` re-arms it after a successful send. */
function useResendCooldown(seconds: number) {
  const [until, setUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setUntil(0);
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback(() => {
    setUntil(Date.now() + seconds * 1000);
  }, [seconds]);

  return { remaining, start };
}

/**
 * Inline failure notice, matching the request submit sheet: the error hue on
 * the icon and the mapped, already-localized message, no card around it.
 */
function ErrorNotice({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.errorRow}
    >
      <MaterialIcons
        name="error"
        size={THEME.ICON.MD}
        color={THEME.COLORS.ERROR}
      />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
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
 * Hero + sign-in methods: the OAuth providers as SURFACE rows (the same card
 * and row rhythm as Settings/Account), then Animu Connect — the passwordless
 * house method — closing the list as the one filled CTA. The terms line ends
 * the screen.
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
  const providersStyle = useEntrance(90);
  const connectStyle = useEntrance(160);

  return (
    <>
      <Animated.View style={[styles.hero, heroStyle]}>
        <Logo size={LOGO_HEIGHT} />
        <Text style={styles.headline}>{dict.LOGIN_HEADLINE}</Text>
        <Text style={styles.subtitle}>{dict.LOGIN_SUBTITLE}</Text>
      </Animated.View>

      <View style={styles.actions}>
        {error && <ErrorNotice message={error} />}

        <Animated.View style={providersStyle}>
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
                    activeOpacity={0.7}
                    disabled={authenticating}
                    onPress={() => onProvider(provider.name)}
                    style={[styles.method, authenticating && styles.buttonDisabled]}
                  >
                    <View style={styles.methodIcon}>
                      {busy ? (
                        <ActivityIndicator color={THEME.COLORS.TEXT} />
                      ) : (
                        <ProviderIcon
                          provider={provider.name}
                          size={THEME.ICON.MD}
                        />
                      )}
                    </View>
                    <Text style={styles.methodLabel}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </Animated.View>

        <Animated.View style={connectStyle}>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{dict.LOGIN_OR_CONTINUE}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.LOGIN_WITH_ANIMU_CONNECT}
            accessibilityState={{ disabled: authenticating }}
            activeOpacity={0.7}
            disabled={authenticating}
            onPress={onConnect}
            style={[
              styles.connectOption,
              authenticating && styles.buttonDisabled,
            ]}
          >
            <View style={styles.methodIcon}>
              <MaterialIcons
                name="alternate-email"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_ON_LIGHT}
              />
            </View>
            <Text style={styles.connectOptionLabel}>
              {dict.LOGIN_WITH_ANIMU_CONNECT}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <LegalLine dict={dict} />
    </>
  );
}

/** The code-step subtitle with the destination address emphasized. */
function CodeSubtitle({ template, email }: { template: string; email: string }) {
  const [before, after] = template.split("{email}");
  return (
    <>
      {before}
      <Text style={styles.subtitleEmail}>{email}</Text>
      {after}
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
  const formStyle = useEntrance(90);
  // No submit button: like the request search, the email step sends from the
  // keyboard's send key, and the code step submits itself once the fourth
  // digit lands. The resend link is the only action that needs a lockout.
  const resendLocked = flow.busy || resendRemaining > 0;

  return (
    <View style={styles.connectBody}>
      <Animated.View style={[styles.connectHeader, headerStyle]}>
        <View style={styles.connectBadge}>
          <MaterialIcons
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
        <EmailCodeFields flow={flow} />

        {error && <ErrorNotice message={error} />}

        {/* The request itself replaces the button: a spinner in its slot. */}
        {flow.busy && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={THEME.COLORS.BRAND} />
          </View>
        )}

        {onCodeStep && (
          <View style={styles.codeActions}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={resendLocked}
              onPress={() => {
                haptics.tap();
                void onResend();
              }}
            >
              <Text style={[styles.link, resendLocked && styles.linkDisabled]}>
                {resendRemaining > 0
                  ? interpolate(dict.LOGIN_CODE_RESEND_IN, {
                      seconds: resendRemaining,
                    })
                  : dict.LOGIN_CODE_RESEND}
              </Text>
            </TouchableOpacity>
            <Text style={styles.linkDot}>•</Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={flow.busy}
              onPress={flow.backToEmail}
            >
              <Text style={[styles.link, flow.busy && styles.linkDisabled]}>
                {dict.LOGIN_CODE_CHANGE_EMAIL}
              </Text>
            </TouchableOpacity>
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
 * welcome headline) with the OAuth providers as app-style rows and Animu
 * Connect closing the list as the filled CTA. The connect step swaps the hero
 * for a centered form: email first, then the 4-digit code.
 */
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
  const resend = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  // Android edge-to-edge draws behind the software keyboard, so the bottom
  // form would stay hidden while typing; iOS is covered by the scroll view's
  // `automaticallyAdjustKeyboardInsets` below.
  const keyboardPadding = useKeyboardPadding(Platform.OS === "android");

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
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home");
    }
  };

  const openConnect = () => {
    haptics.tap();
    setProviderError(null);
    flow.setError(null);
    setStep("connect");
  };

  const error = providerError ?? flow.error;

  return (
    <View style={styles.container}>
      <AuthBackdrop />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_BACK}
            activeOpacity={0.7}
            hitSlop={8}
            onPress={goBack}
            style={styles.backButton}
          >
            <BackArrow />
          </TouchableOpacity>

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
    </View>
  );
}
