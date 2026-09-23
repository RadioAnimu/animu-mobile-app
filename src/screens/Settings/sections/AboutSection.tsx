import { View } from "react-native";

import { version } from "@app/package.json";
import { SectionTitle } from "@/components/SectionTitle";
import { useDict } from "@/hooks/useDict";
import { ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

interface Props {
  onPress: () => void;
}

/** Entry point to the About screen: versions, credits, donors, licensing. */
export function AboutSection({ onPress }: Props) {
  const dict = useDict();

  return (
    <>
      <SectionTitle title={dict.ABOUT_TITLE} icon="info" />
      <View style={styles.group}>
        <ValueRow
          icon="info"
          label={dict.SETTINGS_ABOUT_ROW}
          description={dict.SETTINGS_ABOUT_ROW_DESC}
          value={`v${version}`}
          onPress={onPress}
        />
      </View>
    </>
  );
}
