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

/** External community links — the website and Discord, moved out of the drawer. */
export function LinksSection() {
  const dict = useDict();

  return (
    <>
      <SectionTitle title={dict.LINKS} icon="link" />
      <View style={styles.group}>
        <LinkRow
          label={dict.LINKS_WEBSITE}
          onPress={() => open(API.WEB_URL)}
        />
        <Divider />
        <LinkRow
          label={dict.LINKS_DISCORD}
          onPress={() => open(API.DISCORD_URL)}
        />
      </View>
    </>
  );
}
