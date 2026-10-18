import * as Application from "expo-application";
import { Platform, View } from "react-native";

import { version } from "@app/package.json";
import { API } from "@/api";
import { RowDivider } from "@/components/ListRow";
import { SectionTitle } from "@/components/SectionTitle";
import { useDict } from "@/hooks/useDict";
import { InfoRow, LinkRow, ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { openInAppBrowser } from "@/utils/browser";

interface Props {
  onOpenAbout: () => void;
}

/** The installed build's version; package.json only when the native one is unknown. */
const APP_VERSION = Application.nativeApplicationVersion ?? version;

/**
 * Help & info: how to start playback by voice, the About screen and the
 * privacy policy — the things a user looks for when something is unclear,
 * kept apart from the settings that change behavior.
 */
export function HelpSection({ onOpenAbout }: Readonly<Props>) {
  const dict = useDict();
  const isIOS = Platform.OS === "ios";

  return (
    <>
      <SectionTitle title={dict.SETTINGS_HELP_TITLE} icon="help-outline" />
      <View style={styles.group}>
        <InfoRow
          icon="record-voice-over"
          label={dict.SETTINGS_ASSISTANT_TITLE}
          description={
            isIOS
              ? dict.SETTINGS_ASSISTANT_HINT_IOS
              : dict.SETTINGS_ASSISTANT_HINT_ANDROID
          }
        />
        <RowDivider />
        <ValueRow
          icon="info"
          label={dict.SETTINGS_ABOUT_ROW}
          value={`v${APP_VERSION}`}
          onPress={onOpenAbout}
        />
        <RowDivider />
        <LinkRow
          icon="privacy-tip"
          label={dict.SETTINGS_PRIVACY_POLICY}
          onPress={() => {
            openInAppBrowser(API.PRIVACY_URL).catch((error) =>
              console.warn("[Settings] privacy policy link failed:", error),
            );
          }}
        />
      </View>
    </>
  );
}
