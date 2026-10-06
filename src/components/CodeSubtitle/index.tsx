import { StyleSheet, Text } from "react-native";

import { THEME } from "@/theme";

interface Props {
  /** Dictionary sentence with an `{email}` placeholder. */
  template: string;
  email: string;
}

/** The code-step sentence with the destination address emphasized. */
export function CodeSubtitle({ template, email }: Readonly<Props>) {
  const [before, after] = template.split("{email}");
  return (
    <>
      {before}
      <Text style={styles.email}>{email}</Text>
      {after}
    </>
  );
}

const styles = StyleSheet.create({
  email: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
