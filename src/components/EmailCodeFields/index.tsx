import { useEffect, useRef } from "react";
import { Text, TextInput } from "react-native";

import { CodeInput, CODE_LENGTH } from "@/components/CodeInput";
import type { EmailCodeFlow } from "@/hooks/useEmailCodeFlow";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { styles } from "@/components/EmailCodeFields/styles";

/**
 * The email/code input pair for the Animu Connect flow. Renders the field for
 * the flow's current step; shared by the Login screen and the account sheet.
 */
export function EmailCodeFields({ flow }: { flow: EmailCodeFlow }) {
  const dict = useDict();
  const autoSubmitted = useRef(false);

  const onCodeStep = flow.step === "code";
  const { code, busy, verify } = flow;

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
    return (
      <>
        <Text style={styles.fieldLabel}>{dict.LOGIN_EMAIL}</Text>
        <TextInput
          style={styles.input}
          value={flow.email}
          onChangeText={flow.setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          // Lets the OS/keyboard offer the saved address instead of retyping.
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          editable={!flow.busy}
          accessibilityLabel={dict.LOGIN_EMAIL}
          placeholder={dict.LOGIN_EMAIL_PLACEHOLDER}
          placeholderTextColor={THEME.COLORS.TEXT_DIM}
          onSubmitEditing={flow.sendCode}
        />
      </>
    );
  }

  return (
    <>
      <Text style={styles.fieldLabel}>{dict.LOGIN_CODE}</Text>
      <CodeInput
        value={flow.code}
        onChangeText={flow.setCode}
        editable={!flow.busy}
        accessibilityLabel={dict.LOGIN_CODE}
      />
    </>
  );
}
