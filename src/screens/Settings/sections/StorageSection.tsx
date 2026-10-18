import { useEffect, useRef } from "react";

import { RowDivider } from "@/components/ListRow";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useCoverStorageSnapshot } from "@/hooks/useCoverStorage";
import { useCoverDiskClearing, useFreedCoverToast } from "@/hooks/useCoverDisk";
import { useDict } from "@/hooks/useDict";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { SettingsRow, ValueRow } from "@/screens/Settings/rows";
import { formatBytes } from "@/utils/format";

interface Props {
  onOpenStorage: () => void;
}

/** Rows for the cover-cache toggle plus the plain-language "free up space" shortcut. */
export function StorageSection({ onOpenStorage }: Readonly<Props>) {
  const { settings } = useUserSettings();
  const save = useSaveSettings();
  const dict = useDict();
  const showFreedToast = useFreedCoverToast();

  // Wipe-in-progress from the storage service — disables the cache toggle
  // (both tap paths: the clean button and the automatic cache-off wipe).
  const cacheWiping = useCoverDiskClearing();
  const { snapshot, measuring, failed, measure } = useCoverStorageSnapshot({
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

  // A running wipe wins; a re-measure keeps the last known total on screen
  // (only the first one has nothing to show); a failed measure is "—", not
  // an empty cache.
  let storageValue: string;
  if (cacheWiping) {
    storageValue = dict.SETTINGS_STORAGE_CLEANING;
  } else if (snapshot) {
    storageValue = formatBytes(snapshot.totalBytes, dict.NUMBER_DECIMAL_SEPARATOR);
  } else if (measuring) {
    storageValue = dict.SETTINGS_VALUE_LOADING;
  } else {
    storageValue = "—";
  }

  return (
    <>
      <SettingsRow
        icon="save-alt"
        label={dict.SETTINGS_MEMORY_CLEAR_CACHE_SWITCH}
        description={dict.SETTINGS_MEMORY_CLEAR_CACHE_DESC}
        value={settings.cacheEnabled}
        disabled={cacheWiping}
        onToggle={() => void save({ cacheEnabled: !settings.cacheEnabled })}
      />
      <RowDivider />
      {/* The live total as the row's value — the technical breakdown and the
            "free up space" action live one tap into Storage. */}
      <ValueRow
        icon="folder-open"
        label={dict.STORAGE_TITLE}
        value={storageValue}
        spokenValue={failed && !cacheWiping ? dict.SETTINGS_VALUE_FAILED : undefined}
        onPress={onOpenStorage}
      />
    </>
  );
}
