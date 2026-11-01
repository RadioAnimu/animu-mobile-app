import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
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
import { ConnectActions } from "@/components/ConnectActions";
import { EmailCodeFields } from "@/components/EmailCodeFields";
import { EmailCodeStepIndicator } from "@/components/EmailCodeStepIndicator";
import { FormError } from "@/components/FormError";
import { KeyboardScrollView } from "@/components/KeyboardScrollView";
import { Logo } from "@/components/Logo";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { AuthFlowCancelled, ProviderEmailTaken } from "@/core/auth";
import { isProviderConfigured } from "@/constants/auth";
import {
  CODE_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS,
} from "@/constants/email-code";
import type { Dict } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import {
  useEmailCodeFlow,
  emailCodeError,
  type EmailCodeFlow,
} from "@/hooks/useEmailCodeFlow";
import { useEmailCodeStepAnnouncement } from "@/hooks/useEmailCodeStepAnnouncement";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useResendCooldown } from "@/hooks/useResendCooldown";
import { useStepFade } from "@/hooks/useStepFade";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { haptics } from "@/utils/haptics";
import { openInAppBrowser } from "@/utils/browser";
import { interpolate } from "@/utils/format";
import type { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { Notice } from "@/components/Notice";
import { ProviderButton } from "@/screens/Login/ProviderButton";
import { HERO_LOGO_HEIGHT, styles } from "@/screens/Login/styles";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;
type Step = "method" | "connect";

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
      delay: step * MOTION.STAGGER,
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
function LegalLine({ dict }: Readonly<{ dict: Dict }>) {
  const [before, after] = dict.LOGIN_LEGAL.split("{link}");

  return (
    <Text style={styles.legal}>
      {before}
      <Text
        accessibilityRole="link"
        onPress={() => {
          void openInAppBrowser(API.PRIVACY_URL).catch((error) =>
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

/** The provider whose account song requests depend on. */
const REQUESTS_PROVIDER = "discord";

/** Discord first (song requests need it), the rest in their given order. */
function orderProviders(providers: ProviderInfo[]): ProviderInfo[] {
  const configured = providers.filter((provider) =>
    isProviderConfigured(provider.name),
  );
  return [
    ...configured.filter((provider) => provider.name === REQUESTS_PROVIDER),
    ...configured.filter((provider) => provider.name !== REQUESTS_PROVIDER),
  ];
}

/**
 * Hero + sign-in methods: the OAuth providers as equal outlined pills (Discord
 * first, marked as the one song requests need), a notice that says why, then
 * Animu Connect — the email-code method for existing accounts — below an "or".
 * No filled button here: nothing on this step is the single right answer. The
 * terms line ends the screen.
 */
function MethodStep({
  dict,
  providers,
  busyProvider,
  authenticating,
  error,
  onProvider,
  onConnect,
}: Readonly<MethodStepProps>) {
  const heroStyle = useEntrance(0);
  const providersStyle = useEntrance(1);
  const connectStyle = useEntrance(2);

  return (
    <>
      <Animated.View style={[styles.hero, heroStyle]}>
        <Logo size={HERO_LOGO_HEIGHT} />
        <Text style={styles.title}>{dict.LOGIN_HEADLINE}</Text>
        <Text style={styles.subtitle}>{dict.LOGIN_SUBTITLE}</Text>
      </Animated.View>

      <Animated.View style={[styles.providers, providersStyle]}>
        {error && (
          <View style={styles.errorSlot}>
            <FormError message={error} center />
          </View>
        )}

        <View style={styles.methods}>
          {orderProviders(providers).map((provider) => (
            <ProviderButton
              key={provider.name}
              provider={provider.name}
              label={interpolate(dict.LOGIN_CONTINUE_WITH, {
                provider: provider.label,
              })}
              perk={
                provider.name === REQUESTS_PROVIDER
                  ? dict.LOGIN_DISCORD_PERK
                  : undefined
              }
              busy={busyProvider === provider.name}
              disabled={authenticating}
              onPress={() => onProvider(provider.name)}
            />
          ))}
        </View>

        <Notice
          icon="info-outline"
          text={dict.LOGIN_REQUESTS_NOTICE}
          style={styles.noticeSlot}
        />
      </Animated.View>

      <Animated.View style={[styles.footerBlock, connectStyle]}>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{dict.LOGIN_OR_CONTINUE}</Text>
          <View style={styles.dividerLine} />
        </View>

        <ProviderButton
          provider="animu"
          label={dict.LOGIN_WITH_ANIMU_CONNECT}
          disabled={authenticating}
          onPress={onConnect}
        />
        <Text style={styles.caption}>{dict.LOGIN_ANIMU_CONNECT_TAGLINE}</Text>

        <LegalLine dict={dict} />
      </Animated.View>
    </>
  );
}

interface ConnectStepProps {
  dict: Dict;
  flow: EmailCodeFlow;
  error: string | null;
  resendRemaining: number;
  onResend: () => Promise<void>;
  onNewHere: () => void;
}

/**
 * Animu Connect: the email form, then the 4-digit code form. Top-aligned and
 * compact so the field, its notice and the keyboard share the screen; the
 * eligibility notice sits above the field because the keyboard covers
 * anything below it.
 *
 * The two steps are one form: the header and the step indicator never change,
 * the address field stays where it was (read-only, with "Change") and only
 * the body below the indicator fades between the steps. The entrance motion
 * plays once, on arriving from the method step.
 */
function ConnectStep({
  dict,
  flow,
  error,
  resendRemaining,
  onResend,
  onNewHere,
}: Readonly<ConnectStepProps>) {
  const onCodeStep = flow.step === "code";
  const headerStyle = useEntrance(0);
  const formStyle = useEntrance(1);
  const bodyOpacity = useStepFade(flow.step);

  return (
    <>
      <Animated.View style={[styles.connectHeader, headerStyle]}>
        <View style={styles.connectBadge}>
          <Icon
            name="alternate-email"
            size={THEME.ICON.LG}
            color={THEME.COLORS.BRAND}
          />
        </View>
        <Text style={styles.title}>{dict.LOGIN_CONNECT_TITLE}</Text>
        <Text style={styles.subtitle}>{dict.LOGIN_CONNECT_SUBTITLE}</Text>
      </Animated.View>

      <Animated.View style={[styles.form, formStyle]}>
        <EmailCodeStepIndicator step={flow.step} />

        <Animated.View style={[styles.connectBody, { opacity: bodyOpacity }]}>
          {!onCodeStep && (
            <Notice
              icon="info-outline"
              text={dict.LOGIN_ANIMU_CONNECT_HINT}
              style={styles.noticeAboveField}
            />
          )}

          <EmailCodeFields flow={flow} autoFocusEmail />

          {onCodeStep && (
            <Text style={styles.caption}>
              {interpolate(dict.LOGIN_CODE_VALIDITY, {
                minutes: CODE_TTL_MINUTES,
              })}
            </Text>
          )}

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

          {onCodeStep ? (
            <View style={styles.connectActions}>
              <ConnectActions
                busy={flow.busy}
                resendRemaining={resendRemaining}
                onResend={() => void onResend()}
              />
            </View>
          ) : (
            // Animu Connect can't create an account, so a new user needs a
            // way out that doesn't read as a dead end.
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={THEME.OPACITY.PRESSED}
              disabled={flow.busy}
              onPress={onNewHere}
              style={styles.link}
            >
              <Text style={styles.linkText}>{dict.LOGIN_CONNECT_NEW_HERE}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
}

/**
 * Sign-in screen: a branded hero over the app artwork (localized wordmark,
 * headline) with the OAuth providers and Animu Connect as sign-in options.
 * The connect step swaps the hero for a compact top-aligned form: email
 * first, then the 4-digit code.
 */
export function Login({ navigation }: Readonly<Props>) {
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
  // Set once a code verifies: the form resets as the screen closes, and that
  // reset is not a step the user should hear announced.
  const [leaving, setLeaving] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const resend = useResendCooldown(RESEND_COOLDOWN_SECONDS);

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
      toast(dict.LOGIN_CONNECT_CODE_SENT);
    },
    onVerified: () => {
      setLeaving(true);
      haptics.success();
      toast(dict.LOGIN_SUCCESS);
      finish();
    },
    mapRequestError: (error) =>
      emailCodeError(dict, error, dict.LOGIN_FAILED, {
        invalid: dict.LOGIN_EMAIL_INVALID,
      }),
    mapVerifyError: (error) => emailCodeError(dict, error, dict.LOGIN_FAILED),
  });

  useEmailCodeStepAnnouncement(flow.step, step === "connect" && !leaving);

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
      } else if (err instanceof ProviderEmailTaken) {
        // Retrying can't help: the user must use their original sign-in.
        haptics.error();
        setProviderError(
          interpolate(dict.LOGIN_PROVIDER_EMAIL_TAKEN, {
            provider:
              providers.find((item) => item.name === provider)?.label ??
              provider,
          }),
        );
      } else {
        console.error(`[Login] ${provider} sign-in failed:`, err);
        haptics.error();
        setProviderError(dict.LOGIN_FAILED);
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const backToMethod = () => {
    setStep("method");
    setProviderError(null);
    flow.setError(null);
  };

  const goBack = () => {
    if (step === "connect") {
      // Same lock as the "Change" button: a send/verify in flight owns the
      // form, so neither the arrow nor hardware back may change its step.
      if (flow.busy) return;
      if (flow.step === "code") {
        flow.backToEmail();
        return;
      }
      backToMethod();
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
  const { windowControlsInset } = useResponsiveLayout();

  return (
    // The stack scene is opaque, so the screen paints the app artwork itself.
    <Background>
      <AuthBackdrop />
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right", "bottom"]}
      >
        {/* Outside the scroll view so it stays reachable with the keyboard up. */}
        {/* In an iPadOS window the back arrow steps past the window controls. */}
        <View style={[styles.topBar, { paddingLeft: THEME.SPACE.SM + windowControlsInset }]}>
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
        <KeyboardScrollView
          contentContainerStyle={styles.content}
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
              onNewHere={backToMethod}
            />
          )}
        </KeyboardScrollView>
      </SafeAreaView>
    </Background>
  );
}
