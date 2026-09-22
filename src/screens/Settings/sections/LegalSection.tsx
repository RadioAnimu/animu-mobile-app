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
 * Store-required legal links. The station's content license (CC BY-NC-SA 4.0,
 * mirrored from the animu.moe footer) and this app's source-code license (MIT)
 * are called out separately, plus the third-party notices for artwork/media
 * that neither license covers. The privacy policy is the same URL declared on
 * the Play listing; the copyright notice text itself lives in the page footer.
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
          label={dict.SETTINGS_CONTENT_LICENSE}
          description={dict.SETTINGS_CONTENT_LICENSE_DESC}
          onPress={() => open(API.CONTENT_LICENSE_URL)}
        />
        <Divider />
        <LinkRow
          icon="code"
          label={dict.SETTINGS_SOURCE_LICENSE}
          description={dict.SETTINGS_SOURCE_LICENSE_DESC}
          onPress={() => open(API.SOURCE_LICENSE_URL)}
        />
        <Divider />
        <LinkRow
          icon="attribution"
          label={dict.SETTINGS_THIRD_PARTY_NOTICES}
          description={dict.SETTINGS_THIRD_PARTY_NOTICES_DESC}
          onPress={() => open(API.THIRD_PARTY_NOTICES_URL)}
        />
      </View>
    </>
  );
}
