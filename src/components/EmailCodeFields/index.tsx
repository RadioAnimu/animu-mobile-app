import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { CodeInput, CODE_LENGTH } from "@/components/CodeInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { EmailCodeFlow } from "@/hooks/useEmailCodeFlow";
import { useDict } from "@/hooks/useDict";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { THEME } from "@/theme";
import { styles } from "@/components/EmailCodeFields/styles";

/**
 * The email/code input pair for the Animu Connect flow. Renders the field for
 * the flow's current step (the email step ends on its "Send code" button, the
 * code step submits itself on the last digit); shared by the Login screen and
 * the Account screen.
 *
 * `autoFocusEmail` is opt-in: the full-screen Login form leans on it, while
 * the Account screen leaves it off so its inline field only raises the
 * keyboard from the user's tap. The code step always takes focus: it only
 * ever appears because the user just asked for a code, so the number pad
 * must be up the moment the boxes are.
 *
 * Neither field flips `editable` off while a request runs. That blurs the
 * focused field and dismisses the keyboard on both platforms, which is what
 * left the code step with no keyboard after "Send code": `busy` locks input
 * instead and focus survives the round trip.
 */
export function EmailCodeFields({
  flow,
  autoFocusEmail = false,
}: {
  flow: EmailCodeFlow;
  autoFocusEmail?: boolean;
}) {
  const dict = useDict();
  const autoSubmitted = useRef(false);
  const [focused, setFocused] = useState(false);
  const emailRef = useRef<TextInput | null>(null);

  const onCodeStep = flow.step === "code";
  const { code, busy, verify } = flow;

  useFocusOnMount(emailRef, autoFocusEmail && !onCodeStep);

  // A complete 4-digit code has no reason to wait for a second tap, so submit
  // as soon as the last box fills. The ref fires once per complete entry
  // (editing a digit re-arms it) and `busy` keeps a failed attempt from
  // looping.
  useEffect(() => {
    if (!onCodeStep || code.length < CODE_LENGTH) {
      autoSubmitted.current = false;
      return;
    }
    if (!autoSubmitted.current && !busy) {
      autoSubmitted.current = true;
      void verify();
    }
  }, [onCodeStep, code, busy, verify]);

  if (flow.step === "email") {
    const canClear = flow.email.length > 0 && !flow.busy;
    return (
      <>
        <Text style={styles.fieldLabel}>{dict.LOGIN_EMAIL}</Text>
        <View style={[styles.field, focused && styles.fieldFocused]}>
          <TextInput
            ref={emailRef}
            style={styles.input}
            value={flow.email}
            onChangeText={(text) => {
              if (!flow.busy) flow.setEmail(text);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // Lets the OS/keyboard offer the saved address instead of retyping.
            autoComplete="email"
            textContentType="emailAddress"
            // The keyboard's send key is a shortcut for the visible button
            // below, and stays grayed out until something is typed.
            returnKeyType="send"
            enablesReturnKeyAutomatically
            accessibilityLabel={dict.LOGIN_EMAIL}
            accessibilityState={{ busy: flow.busy }}
            placeholder={dict.LOGIN_EMAIL_PLACEHOLDER}
            placeholderTextColor={THEME.COLORS.TEXT_DIM}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={flow.sendCode}
          />
          {canClear && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={dict.A11Y_CLEAR_INPUT}
              activeOpacity={THEME.OPACITY.PRESSED}
              hitSlop={THEME.HIT_SLOP.SM}
              onPress={() => flow.setEmail("")}
              style={styles.fieldIcon}
            >
              <Icon
                name="cancel"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_DIM}
              />
            </TouchableOpacity>
          )}
        </View>
        <PrimaryButton
          label={dict.LOGIN_SEND_CODE}
          icon="send"
          loading={flow.busy}
          disabled={flow.email.trim().length === 0}
          onPress={() => void flow.sendCode()}
          style={styles.submit}
        />
      </>
    );
  }

  return (
    <>
      <Text style={styles.fieldLabel}>{dict.LOGIN_CODE}</Text>
      {/* The step just changed, so the field mounts here: focus it right away
          and the one-time-code keyboard opens without another tap. */}
      <CodeInput
        value={flow.code}
        onChangeText={flow.setCode}
        busy={flow.busy}
        autoFocus
        accessibilityLabel={dict.LOGIN_CODE}
      />
    </>
  );
}
