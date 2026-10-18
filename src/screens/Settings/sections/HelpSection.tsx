import * as Application from "expo-application";
import { Platform, View } from "react-native";

import { version } from "@app/package.json";
import { API } from "@/api";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { RowDivider } from "@/components/ListRow";
import { SectionTitle } from "@/components/SectionTitle";
import { useDict } from "@/hooks/useDict";
import { interpolate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { useStoreReview } from "@/utils/store-review";
import { InfoRow, LinkRow, ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { openExternal, openInAppBrowser } from "@/utils/browser";

interface Props {
  onOpenAbout: () => void;
}

/** The installed build's version; package.json only when the native one is unknown. */
const APP_VERSION = Application.nativeApplicationVersion ?? version;

/**
 * Help & info: the store review row (matched to where the app came from),
 * how to start playback by voice, the About screen and the privacy policy —
 * the things a user looks for when something is unclear, kept apart from the
 * settings that change behavior.
 */
export function HelpSection({ onOpenAbout }: Readonly<Props>) {
  const dict = useDict();
  const { toast } = useAlert();
  const review = useStoreReview();
  const isIOS = Platform.OS === "ios";

  /** Only once the store resolved — a pre-resolution tap has nothing to say,
      and the strings read whole instead of holding a `{store}` token. */
  const rateCopy = review.name
    ? {
        description: interpolate(dict.SETTINGS_RATE_APP_DESC, {
          store: review.name,
        }),
        hint: review.url
          ? dict.ABOUT_OPENS_BROWSER
          : interpolate(dict.SETTINGS_RATE_SOON, { store: review.name }),
      }
    : {};

  /** Store pages leave the app — they belong to the store that lists it. */
  const openRateRow = () => {
    haptics.select();
    if (!review.name) return;
    if (!review.url) {
      toast(
        interpolate(dict.SETTINGS_RATE_SOON, { store: review.name }),
        "info",
      );
      return;
    }
    openExternal(review.url).catch((error) => {
      console.warn("[Settings] store review link failed:", error);
      toast(dict.SETTINGS_RATE_OPEN_ERROR, "error");
    });
  };

  return (
    <>
      <SectionTitle title={dict.SETTINGS_HELP_TITLE} icon="help-outline" />
      <View style={styles.group}>
        <LinkRow
          icon="star-rate"
          label={dict.SETTINGS_RATE_APP}
          description={rateCopy.description}
          hint={rateCopy.hint}
          dimmed={review.name != null && !review.url}
          onPress={openRateRow}
        />
        <RowDivider />
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
