import { useSyncExternalStore } from "react";
import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { coverDiskStorage } from "@/core/services/cover-disk-storage.service";
import { useCoverStorageSnapshot } from "@/hooks/useCoverStorage";
import { useDict } from "@/hooks/useDict";
import { cleanLabel } from "@/screens/Settings/labels";
import { Divider, SettingsRow, ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { formatBytes } from "@/utils/format";

interface Props {
  onOpenStorage: () => void;
}

/** Cover-cache toggle plus the plain-language "free up space" shortcut. */
export function StorageSection({ onOpenStorage }: Props) {
  const { settings, updateSettings } = useUserSettings();
  const dict = useDict();
  // Wipe-in-progress from the storage service — disables the cache toggle
  // (both tap paths: the clean button and the automatic cache-off wipe).
  const cacheWiping = useSyncExternalStore(
    (listener) => coverDiskStorage.subscribe(listener),
    () => coverDiskStorage.isClearing,
  );
  const { snapshot, measuring } = useCoverStorageSnapshot();

  return (
    <>
      <SectionTitle title={dict.SETTINGS_MEMORY_TITLE} icon="sd-storage" />
      <View style={styles.group}>
        <SettingsRow
          label={cleanLabel(dict.SETTINGS_MEMORY_CLEAR_CACHE_SWITCH)}
          description={dict.SETTINGS_MEMORY_CLEAR_CACHE_DESC}
          value={settings.cacheEnabled}
          disabled={cacheWiping}
          onToggle={() =>
            updateSettings({ cacheEnabled: !settings.cacheEnabled })
          }
        />
        <Divider />
        {/* Plain-language promise ("Free up space") with the live total as
            proof — the technical breakdown lives one tap into Storage. */}
        <ValueRow
          label={dict.SETTINGS_STORAGE_FREE_UP}
          value={measuring ? "· · ·" : formatBytes(snapshot?.totalBytes ?? 0)}
          onPress={onOpenStorage}
        />
      </View>
    </>
  );
}
