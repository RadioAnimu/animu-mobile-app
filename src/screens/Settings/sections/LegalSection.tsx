import * as Linking from "expo-linking";
import { View } from "react-native";

import { API } from "@/api";
import { SectionTitle } from "@/components/SectionTitle";
import { useDict } from "@/hooks/useDict";
import { Divider, LinkRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

const open = (url: string) => {
  void Linking.openURL(url).catch((error) =>
    console.warn("[Links] openURL failed:", error),
  );
};

/**
 * Store-required legal links: the privacy policy (same URL declared on the
 * Play listing) and the project's copyright/license notice mirrored from the
 * animu.moe footer. The notice text itself lives in the page footer.
 */
export function LegalSection() {
  const dict = useDict();

  return (
    <>
      <SectionTitle title={dict.SETTINGS_LEGAL_TITLE} icon="gavel" />
      <View style={styles.group}>
        <LinkRow
          icon="privacy-tip"
          label={dict.SETTINGS_PRIVACY_POLICY}
          onPress={() => open(API.PRIVACY_URL)}
        />
        <Divider />
        <LinkRow
          icon="copyright"
          label={dict.SETTINGS_COPYRIGHT_LICENSE}
          description={dict.SETTINGS_COPYRIGHT_DESC}
          onPress={() => open(API.LICENSE_URL)}
        />
      </View>
    </>
  );
}
