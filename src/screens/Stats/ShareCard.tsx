import React, { Fragment } from "react";
import { Text, View } from "react-native";
import { Image, type ImageSource } from "expo-image";

import { Avatar } from "@/components/Avatar";
import { Icon, type IconName } from "@/components/Icon";
import type { ListenStatsSnapshot } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { cardThemeFromAccent } from "@/screens/Stats/card-theme";
import { SHARE_LABEL_ICON, styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import {
  formatListenDuration,
  formatStreakLabel,
  listenDurationUnits,
} from "@/utils/format";

/** Covers in the top-requests deck. */
const DECK_SIZE = 5;
/** The station's address, printed under the logo. */
const STATION_URL = "www.animu.moe";

interface Props {
  /** Account display name (username) — the big line. */
  name: string;
  /** Provider @handle — the small line, omitted when it mirrors the name. */
  handle: string | null;
  avatarUrl: string | null;
  /** Banner image source (auth URLs carry the session header). */
  bannerSource: ImageSource | undefined;
  /** Provider accent extracted from the banner — drives scrim/text colors. */
  accentColor: string | undefined;
  /** Per-language Radio Animu logo for the card's signature. */
  logoSource: number;
  /** Right padding so the identity never runs under the action overlay. */
  actionsInset: number;
  snap: ListenStatsSnapshot;
  dict: Dict;
}

/** A headline stat — icons echo the stats screen's overview tiles. */
interface Stat {
  icon: IconName;
  label: string;
  value: string;
}

/**
 * The shareable listening card: the profile banner full-bleed and stained
 * underneath, the listener identity up top, the headline stats (listening,
 * longest streak, requests sent) and the most-requested songs' covers as a
 * stacked deck, with the station logo and address in the corner. Rendered
 * as a real view — it doubles as the live preview the user can screenshot,
 * and `react-native-view-shot` rasterizes it for sharing.
 */
export function ShareCard({
  name,
  handle,
  avatarUrl,
  bannerSource,
  accentColor,
  logoSource,
  actionsInset,
  snap,
  dict,
}: Readonly<Props>) {
  const theme = cardThemeFromAccent(accentColor);
  // Every piece of text carries the theme's halo, so it holds up on busy
  // or bright banner art, not just on the average stain.
  const ink = (color: string) => [{ color }, theme.halo];
  const covers = snap.topRequests
    .map((r) => r.art)
    .filter(Boolean)
    .slice(0, DECK_SIZE);
  // The handle only adds information when it differs from the display name
  // ("Ness" + "@ness.js" reads well; "ness.js" + "@ness.js" is noise).
  const handleLine =
    handle && handle.toLowerCase() !== name.toLowerCase()
      ? `@${handle}`
      : null;
  const stats: Stat[] = [
    {
      icon: "headphones",
      label: dict.STATS_CARD_LISTENED,
      value: formatListenDuration(
        snap.totalMs / 60_000,
        listenDurationUnits(dict),
      ),
    },
    {
      icon: "emoji-events",
      label: dict.STATS_CARD_STREAK,
      value: formatStreakLabel(snap.maxStreak, dict),
    },
    {
      icon: "send",
      label: dict.STATS_CARD_REQUESTS_SENT,
      value: `${snap.totalSubmitted}`,
    },
  ];

  return (
    <View
      style={[
        styles.shareCard,
        { backgroundColor: accentColor || THEME.COLORS.FRAME },
      ]}
    >
      {bannerSource ? (
        <Image
          source={bannerSource}
          style={styles.shareCardFill}
          contentFit="cover"
          // Banners are low-res; a whisper of blur hides the pixelation
          // without reading as "blurred".
          blurRadius={3}
          recyclingKey={String(bannerSource.uri ?? "")}
        />
      ) : null}
      <View style={[styles.shareCardFill, { backgroundColor: theme.scrim }]} />

      <View style={styles.shareCardContent}>
        <View
          style={[styles.shareCardIdentity, { paddingRight: actionsInset }]}
        >
          <Avatar
            uri={avatarUrl}
            style={[styles.shareCardAvatar, { borderColor: theme.ring }]}
          />
          <View style={styles.shareCardNames}>
            <Text numberOfLines={1} style={[styles.shareCardName, ink(theme.text)]}>
              {name}
            </Text>
            {handleLine && (
              <Text
                numberOfLines={1}
                style={[styles.shareCardHandle, ink(theme.subtext)]}
              >
                {handleLine}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.shareCardStats}>
          {stats.map((stat, index) => (
            <Fragment key={stat.label}>
              {index > 0 && (
                <View
                  style={[
                    styles.shareCardStatDivider,
                    { backgroundColor: theme.divider },
                  ]}
                />
              )}
              <View style={styles.shareCardStat}>
                <View style={styles.shareCardLabelRow}>
                  <Icon
                    name={stat.icon}
                    size={SHARE_LABEL_ICON}
                    color={theme.subtext}
                    style={theme.halo}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.shareCardLabel, ink(theme.subtext)]}
                  >
                    {stat.label}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.shareCardStatValue, ink(theme.text)]}
                >
                  {stat.value}
                </Text>
              </View>
            </Fragment>
          ))}
        </View>

        {/* Deck left, signature bottom-right — one row, no dead band. */}
        <View style={styles.shareCardFooter}>
          {covers.length > 0 && (
            <View style={styles.shareCardRequests}>
              <View style={styles.shareCardLabelRow}>
                <Icon
                  name="queue-music"
                  size={SHARE_LABEL_ICON}
                  color={theme.subtext}
                  style={theme.halo}
                />
                <Text style={[styles.shareCardLabel, ink(theme.subtext)]}>
                  {dict.STATS_TOP_REQUESTS}
                </Text>
              </View>
              <View style={styles.shareCardCoverRow}>
                {covers.map((url, index) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    style={[
                      styles.shareCardCover,
                      index > 0 && styles.shareCardCoverOverlap,
                      // Most-requested on top of the stack.
                      { zIndex: covers.length - index },
                    ]}
                    contentFit="cover"
                    recyclingKey={url}
                    transition={0}
                  />
                ))}
              </View>
            </View>
          )}
          <View style={styles.shareCardSignature}>
            {/* Alpha-shaped logo shadow: a dark, blurred copy of the same
                transparent PNG behind the artwork — a soft halo, not a
                box (a tight blur read as a doubled tagline). */}
            <View style={styles.shareCardLogoWrap}>
              <Image
                source={logoSource}
                style={styles.shareCardLogoShadow}
                contentFit="contain"
                tintColor="rgba(22, 1, 53, 0.6)"
                blurRadius={8}
              />
              <Image
                source={logoSource}
                style={styles.shareCardLogo}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.shareCardUrl, ink(theme.subtext)]}>
              {STATION_URL}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
