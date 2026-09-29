import { useEffect, useRef, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import { CodeInput, CODE_LENGTH } from "@/components/CodeInput";
import type { EmailCodeFlow } from "@/hooks/useEmailCodeFlow";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { styles } from "@/components/EmailCodeFields/styles";

/**
 * The email/code input pair for the Animu Connect flow. Renders the field for
 * the flow's current step; shared by the Login screen and the Account screen.
 *
 * `autoFocus` is opt-in: the full-screen Login form leans on it, while the
 * Account screen leaves it off so its inline field only raises the keyboard
 * from the user's tap.
 */
export function EmailCodeFields({
  flow,
  autoFocus = false,
}: {
  flow: EmailCodeFlow;
  autoFocus?: boolean;
}) {
  const dict = useDict();
  const autoSubmitted = useRef(false);
  const [focused, setFocused] = useState(false);
  const emailRef = useRef<TextInput | null>(null);

  const onCodeStep = flow.step === "code";
  const { code, busy, verify } = flow;

  // A failed send flips `editable` off while the request runs, which blurs
  // the field on Android; focus it again when the request ends so fixing the
  // address (and pressing the keyboard's send key) takes no extra tap.
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (!onCodeStep && !busy && wasBusy.current) emailRef.current?.focus();
    wasBusy.current = busy;
  }, [busy, onCodeStep]);

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
            onChangeText={flow.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // Lets the OS/keyboard offer the saved address instead of retyping.
            autoComplete="email"
            textContentType="emailAddress"
            // There is no send button (same as the request search): the
            // keyboard's send key carries the step, and stays grayed out
            // until something is typed.
            returnKeyType="send"
            enablesReturnKeyAutomatically
            autoFocus={autoFocus}
            editable={!flow.busy}
            accessibilityLabel={dict.LOGIN_EMAIL}
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
              activeOpacity={0.7}
              hitSlop={8}
              onPress={() => flow.setEmail("")}
              style={styles.fieldIcon}
            >
              <MaterialIcons
                name="cancel"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_DIM}
              />
            </TouchableOpacity>
          )}
        </View>
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
        editable={!flow.busy}
        autoFocus={autoFocus}
        accessibilityLabel={dict.LOGIN_CODE}
      />
    </>
  );
}
