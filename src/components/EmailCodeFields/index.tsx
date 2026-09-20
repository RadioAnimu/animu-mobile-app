import { Text, TextInput } from "react-native";

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
      <TextInput
        style={styles.input}
        value={flow.code}
        onChangeText={flow.setCode}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={6}
        editable={!flow.busy}
        accessibilityLabel={dict.LOGIN_CODE}
        placeholder={dict.LOGIN_CODE_PLACEHOLDER}
        placeholderTextColor={THEME.COLORS.TEXT_DIM}
        onSubmitEditing={flow.verify}
      />
    </>
  );
}
