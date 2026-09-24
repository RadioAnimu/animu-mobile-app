import { useEffect, useRef } from "react";
import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useCoverStorageSnapshot } from "@/hooks/useCoverStorage";
import {
  useCoverDiskClearing,
  useFreedCoverToast,
} from "@/hooks/useCoverDisk";
import { useDict } from "@/hooks/useDict";
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
  const showFreedToast = useFreedCoverToast();

  // Wipe-in-progress from the storage service — disables the cache toggle
  // (both tap paths: the clean button and the automatic cache-off wipe).
  const cacheWiping = useCoverDiskClearing();
  const { snapshot, measuring, measure } = useCoverStorageSnapshot({
    onFreed: showFreedToast,
  });

  // Wipes started on THIS screen (the cache-off toggle, a cover-quality
  // change) settle without a navigation — re-measure when they do, or the
  // row would keep the pre-wipe total until the next screen change. The
  // initial false is the mount state, not a settled wipe — the focus
  // measure already owns it, so skip the first run.
  const wipeSettledOnce = useRef(false);
  useEffect(() => {
    if (!wipeSettledOnce.current) {
      wipeSettledOnce.current = true;
      return;
    }
    if (!cacheWiping) void measure();
  }, [cacheWiping, measure]);

  return (
    <>
      <SectionTitle title={dict.SETTINGS_MEMORY_TITLE} icon="sd-storage" />
      <View style={styles.group}>
        <SettingsRow
          icon="save-alt"
          label={dict.SETTINGS_MEMORY_CLEAR_CACHE_SWITCH}
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
          icon="folder-open"
          label={dict.SETTINGS_STORAGE_FREE_UP}
          value={measuring ? "· · ·" : formatBytes(snapshot?.totalBytes ?? 0)}
          onPress={onOpenStorage}
        />
      </View>
    </>
  );
}
