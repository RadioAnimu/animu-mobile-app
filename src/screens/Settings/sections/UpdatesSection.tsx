import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { useDict } from "@/hooks/useDict";
import { isOtaSupported } from "@/core/ota";
import { ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

/** Over-the-air update check (hidden when the platform can't apply them). */
export function UpdatesSection() {
  const { value, check } = useOtaUpdate();
  const dict = useDict();

  if (!isOtaSupported()) return null;

  return (
    <>
      <SectionTitle title={dict.SETTINGS_UPDATES_TITLE} icon="system-update" />
      <View style={styles.group}>
        <ValueRow
          icon="system-update"
          label={dict.SETTINGS_UPDATES_ROW}
          description={dict.SETTINGS_UPDATES_DESC}
          value={value()}
          onPress={() => void check()}
        />
      </View>
    </>
  );
}
