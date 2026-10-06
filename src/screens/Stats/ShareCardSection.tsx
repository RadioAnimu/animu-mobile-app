import React, { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import * as MediaLibrary from "expo-media-library";
import { canSaveToPhotoLibrary } from "@/utils/mediaLibrary";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import type { ListenStatsSnapshot } from "@/core/services/listen-stats.service";
import type { AuthProfile, User } from "@/core/domain/user";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { IMGS } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { ShareCard } from "@/screens/Stats/ShareCard";
import { styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";
import { resolveMediaSource } from "@/utils/authImage";

type MaterialIconName = React.ComponentProps<typeof Icon>["name"];

/** Share raster scale — ~2100px wide JPEG from a ~345pt card: crisp text,
 * light file for chat/social upload limits. */
const CAPTURE_SCALE = 2;

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
 * floating actions rasterize it with `react-native-view-shot` into a JPEG
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
  const [busy, setBusy] = useState<"share" | "download" | null>(null);

  const captureCard = useCallback(async (): Promise<string> => {
    if (!cardRef.current) throw new Error("card not mounted");
    const { width = 0, height = 0 } = cardSize.current ?? {};
    return captureRef(cardRef.current, {
      format: "jpg",
      quality: 0.92,
      result: "tmpfile",
      // Explicit output size: the raster is 2× the card points, crisp
      // enough for social feeds on any screen density.
      ...(width > 0 && height > 0
        ? {
            width: Math.round(width * CAPTURE_SCALE),
            height: Math.round(height * CAPTURE_SCALE),
          }
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
            mimeType: "image/jpeg",
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
        <View style={styles.lockedCard}>
          <View style={styles.lockedIconCircle}>
            <Icon name="lock" size={24} color={THEME.COLORS.BRAND} />
          </View>
          <Text style={styles.emptyTitle}>{dict.STATS_CARD_LOCKED_TITLE}</Text>
          <Text style={styles.emptyText}>{dict.STATS_CARD_LOCKED_DESC}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={THEME.OPACITY.PRESSED}
            style={styles.shareActionButton}
            onPress={() => {
              haptics.select();
              onSignIn();
            }}
          >
            <Icon
              name="login"
              size={18}
              color={THEME.COLORS.TEXT_ON_LIGHT}
            />
            <Text style={styles.shareActionLabel}>
              {dict.SETTINGS_ACCOUNT_SIGN_IN}
            </Text>
          </TouchableOpacity>
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
          }}
        >
          <ShareCard
            name={name}
            handle={handle}
            avatarUrl={user.avatarUrl}
            bannerSource={resolveMediaSource(
              media.banner,
              banner?.url,
              user.sessionToken,
              `stats-card-${imageVersion}`,
            )}
            accentColor={banner?.color ?? undefined}
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
            accessibilityLabel={dict.STATS_CARD_SHARE}
            busy={busy === "share"}
            disabled={busy != null}
            onPress={() => void run("share")}
          />
          {androidDownload && (
            <CardActionButton
              icon="download"
              accessibilityLabel={dict.STATS_CARD_DOWNLOAD}
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

interface ActionProps {
  icon: MaterialIconName;
  accessibilityLabel: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function CardActionButton({
  icon,
  accessibilityLabel,
  busy,
  disabled = busy,
  onPress,
}: Readonly<ActionProps>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: disabled || undefined,
        busy: busy || undefined,
      }}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.cardActionButton, busy && styles.cardActionDisabled]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={THEME.COLORS.TEXT} />
      ) : (
        <Icon
          name={icon}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT}
        />
      )}
    </TouchableOpacity>
  );
}
