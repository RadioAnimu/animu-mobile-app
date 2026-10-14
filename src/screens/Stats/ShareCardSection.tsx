import React, { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import * as MediaLibrary from "expo-media-library";
import { canSaveToPhotoLibrary } from "@/utils/mediaLibrary";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { Image, type ImageSource } from "expo-image";
import {
  ActivityIndicator,
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionTitle } from "@/components/SectionTitle";
import type { ListenStatsSnapshot } from "@/core/services/listen-stats.service";
import type { AuthProfile, User } from "@/core/domain/user";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { IMGS } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { captureSize } from "@/screens/Stats/capture";
import { cardThemeFromAccent } from "@/screens/Stats/card-theme";
import { ShareCard } from "@/screens/Stats/ShareCard";
import { styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";
import { resolveMediaSource } from "@/utils/authImage";

type MaterialIconName = React.ComponentProps<typeof Icon>["name"];

interface Props {
  user: User | null;
  profile: AuthProfile | null;
  /** Bumped on avatar/banner change — cache-busts the card's banner. */
  imageVersion: number;
  snap: ListenStatsSnapshot;
  onSignIn: () => void;
}

/**
 * The shareable listening card at the top of the stats screen. The card is
 * a real view — always visible as the preview (screenshot-able) — and the
 * floating actions rasterize it with `react-native-view-shot` into a PNG
 * that goes to the system share sheet (Android also gets a direct
 * save-to-gallery button). Requires an account: signed-out users get the
 * unlock prompt instead.
 */
export function ShareCardSection({
  user,
  profile,
  imageVersion,
  snap,
  onSignIn,
}: Readonly<Props>) {
  const dict = useDict();
  const { settings } = useUserSettings();
  const { media } = useAuth();
  const { toast } = useAlert();
  const cardRef = useRef<View | null>(null);
  const cardSize = useRef<{ width: number; height: number } | null>(null);
  // Mirrors `cardSize` for rendering: the frosted buttons crop the banner
  // at the card's own size.
  const [cardBox, setCardBox] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [busy, setBusy] = useState<"share" | "download" | null>(null);

  const captureCard = useCallback(async (): Promise<string> => {
    if (!cardRef.current) throw new Error("card not mounted");
    const { width = 0, height = 0 } = cardSize.current ?? {};
    return captureRef(cardRef.current, {
      // Lossless: flat text, hairlines and the logo stay crisp instead of
      // picking up JPEG ringing.
      format: "png",
      result: "tmpfile",
      // Explicit output size: at least feed resolution on every density.
      ...(width > 0 && height > 0
        ? captureSize(width, height, PixelRatio.get(), Platform.OS)
        : {}),
    });
  }, []);

  /** Best-effort delete of the raster's temp file once consumers are done. */
  const discardTmpFile = useCallback((uri: string) => {
    try {
      new File(uri.startsWith("file://") ? uri : `file://${uri}`).delete();
    } catch {
      // The OS clears tmp anyway — a failed unlink must not fail the action.
    }
  }, []);

  const run = useCallback(
    async (kind: "share" | "download") => {
      haptics.select();
      setBusy(kind);
      try {
        const uri = await captureCard();
        if (kind === "share") {
          if (!(await Sharing.isAvailableAsync())) {
            toast(dict.STATS_CARD_FAILED);
            return;
          }
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: dict.STATS_CARD_SHARE,
          });
        } else {
          if (!(await canSaveToPhotoLibrary())) {
            toast(dict.STATS_CARD_FAILED);
            return;
          }
          await MediaLibrary.Asset.create(uri);
          toast(dict.STATS_CARD_SAVED);
        }
        // The consumer (share sheet / gallery) has the bytes now — the
        // raster's temp file has no further use. Repeated shares otherwise
        // accumulate tmp files until the OS housekeeping runs.
        discardTmpFile(uri);
      } catch (error) {
        console.warn("[ShareCard] failed:", error);
        toast(dict.STATS_CARD_FAILED);
      } finally {
        setBusy(null);
      }
    },
    [captureCard, discardTmpFile, dict, toast],
  );

  if (!user) {
    return (
      <>
        <SectionTitle
          title={dict.STATS_CARD_TITLE}
          icon="card-membership"
          first
        />
        <View style={[styles.group, styles.lockedCard]}>
          <View style={styles.lockedIconCircle}>
            <Icon name="lock" size={THEME.ICON.LG} color={THEME.COLORS.BRAND} />
          </View>
          <View style={styles.lockedText}>
            <Text style={styles.emptyTitle}>{dict.STATS_CARD_LOCKED_TITLE}</Text>
            <Text style={styles.emptyText}>{dict.STATS_CARD_LOCKED_DESC}</Text>
          </View>
          <PrimaryButton
            icon="login"
            label={dict.SETTINGS_ACCOUNT_SIGN_IN}
            style={styles.lockedButton}
            onPress={() => {
              haptics.select();
              onSignIn();
            }}
          />
        </View>
      </>
    );
  }

  const banner = profile?.banner;
  // Display name (username) on the big line, provider handle on the small
  // one — getUserName prefers the handle, which would duplicate the line
  // when both exist.
  const name = profile?.user.username || user.username;
  const handle = profile?.user.handle || user.nickname || null;
  // One floating action on iOS (the share sheet already offers "Save
  // Image"); Android's sheet can't guarantee a save, so it also gets a
  // direct download.
  const androidDownload = Platform.OS === "android";
  const bannerSource = resolveMediaSource(
    media.banner,
    banner?.url,
    user.sessionToken,
    `stats-card-${imageVersion}`,
  );
  const accentColor = banner?.color ?? undefined;
  // What sits behind the floating buttons, for their frosted fill: the
  // banner at the card's size, stained like the card, offset per button.
  const backdropAt = (fromRight: number): Backdrop | null =>
    cardBox && {
      source: bannerSource,
      base: accentColor || THEME.COLORS.FRAME,
      scrim: cardThemeFromAccent(accentColor).scrim,
      width: cardBox.width,
      height: cardBox.height,
      left:
        cardBox.width -
        THEME.SPACE.MD -
        CARD_ACTION_SIZE * (fromRight + 1) -
        THEME.SPACE.SM * fromRight,
      top: THEME.SPACE.MD,
    };

  return (
    <>
      <SectionTitle
        title={dict.STATS_CARD_TITLE}
        icon="card-membership"
        first
      />
      <View>
        <View
          ref={cardRef}
          collapsable={false}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            cardSize.current = { width, height };
            setCardBox({ width, height });
          }}
        >
          <ShareCard
            name={name}
            handle={handle}
            avatarUrl={user.avatarUrl}
            bannerSource={bannerSource}
            accentColor={accentColor}
            logoSource={IMGS[settings.selectedLanguage].LOGO}
            actionsInset={androidDownload ? scale(104) : scale(56)}
            snap={snap}
            dict={dict}
          />
        </View>
        {/* Siblings of the captured view — never part of the shared image. */}
        <View style={styles.cardActions} pointerEvents="box-none">
          {/* One shared capture pipeline: any action in flight locks all of
              them out, so a second tap can never run a concurrent capture
              (and overwrite the busy flag mid-flight). */}
          <CardActionButton
            icon="share"
            label={dict.STATS_CARD_SHARE}
            backdrop={backdropAt(androidDownload ? 1 : 0)}
            busy={busy === "share"}
            disabled={busy != null}
            onPress={() => void run("share")}
          />
          {androidDownload && (
            <CardActionButton
              icon="download"
              label={dict.STATS_CARD_DOWNLOAD}
              backdrop={backdropAt(0)}
              busy={busy === "download"}
              disabled={busy != null}
              onPress={() => void run("download")}
            />
          )}
        </View>
      </View>
    </>
  );
}

/** Diameter of the floating card actions (matches `cardActionButton`). */
const CARD_ACTION_SIZE = scale(40);
/** Blur of the banner seen through the buttons — the frosted-glass read. */
const FROST_BLUR = 18;

/** The card's banner as seen from one button, for its frosted fill. */
interface Backdrop {
  source: ImageSource | undefined;
  /** Card base colour under the banner (shows while it loads / without one). */
  base: string;
  scrim: string;
  width: number;
  height: number;
  /** Button's offset inside the card. */
  left: number;
  top: number;
}

interface ActionProps {
  icon: MaterialIconName;
  label: string;
  /** Null until the card has laid out — the plain tint shows meanwhile. */
  backdrop: Backdrop | null;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * A floating frosted-glass icon action over the card's top-right corner.
 * There is no native blur here, so the button draws its own: the slice of
 * the card banner right behind it, heavily blurred and stained the same
 * way, under a faint sheen — the card shows through, softened, in its own
 * colors.
 */
function CardActionButton({
  icon,
  label,
  backdrop,
  busy,
  disabled = busy,
  onPress,
}: Readonly<ActionProps>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        // Explicit booleans: on Android an `undefined` field does not clear a
        // previously reported `true`, so TalkBack kept saying "busy" after
        // the save had finished.
        disabled: !!disabled,
        busy,
      }}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.cardActionButton, busy && styles.cardActionDisabled]}
    >
      {backdrop && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.cardActionFrost,
              {
                backgroundColor: backdrop.base,
                width: backdrop.width,
                height: backdrop.height,
                left: -backdrop.left,
                top: -backdrop.top,
              },
            ]}
          >
            {backdrop.source ? (
              <Image
                source={backdrop.source}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={FROST_BLUR}
                recyclingKey={String(backdrop.source.uri ?? "")}
              />
            ) : null}
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: backdrop.scrim }]}
            />
          </View>
          <View style={styles.cardActionTint} />
        </View>
      )}
      {busy ? (
        <ActivityIndicator size="small" color={THEME.COLORS.TEXT} />
      ) : (
        <Icon name={icon} size={THEME.ICON.MD} color={THEME.COLORS.TEXT} />
      )}
    </TouchableOpacity>
  );
}
