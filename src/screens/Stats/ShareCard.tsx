import React from "react";
import { Text, View } from "react-native";
import { Image, type ImageSource } from "expo-image";

import { Avatar } from "@/components/Avatar";
import type { ListenStatsSnapshot } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { cardThemeFromAccent } from "@/screens/Stats/card-theme";
import { styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import { formatListenDuration, interpolate } from "@/utils/format";

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

/**
 * The shareable listening card: a hero with the profile banner dimmed
 * underneath, the listener identity up top, the headline stats and the
 * most-requested tracks' artworks. Rendered as a real view — it doubles as
 * the live preview the user can screenshot, and `react-native-view-shot`
 * rasterizes it for sharing.
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
}: Props) {
  const theme = cardThemeFromAccent(accentColor);
  const streakLabel =
    snap.maxStreak === 1
      ? dict.STATS_STREAK_DAY
      : interpolate(dict.STATS_STREAK_DAYS, { n: snap.maxStreak });
  const covers = snap.topRequests.slice(0, 5);
  // The handle only adds information when it differs from the display name
  // ("Ness" + "@ness.js" reads well; "ness.js" + "@ness.js" is noise).
  const handleLine =
    handle && handle.toLowerCase() !== name.toLowerCase()
      ? `@${handle}`
      : null;

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
          style={styles.shareCardBanner}
          contentFit="cover"
          recyclingKey={String(bannerSource.uri ?? "")}
        />
      ) : null}
      <View
        style={[styles.shareCardScrim, { backgroundColor: theme.scrim }]}
      />

      <View style={styles.shareCardContent}>
        <View
          style={[styles.shareCardIdentity, { paddingRight: actionsInset }]}
        >
          <Avatar uri={avatarUrl} style={styles.shareCardAvatar} />
          <View style={styles.shareCardNames}>
            <Text
              numberOfLines={1}
              style={[styles.shareCardName, { color: theme.text }]}
            >
              {name}
            </Text>
            {handleLine && (
              <Text
                numberOfLines={1}
                style={[styles.shareCardHandle, { color: theme.subtext }]}
              >
                {handleLine}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.shareCardStats}>
          <View style={styles.shareCardStat}>
            <Text style={[styles.shareCardStatLabel, { color: theme.subtext }]}>
              {dict.STATS_TOTAL}
            </Text>
            <Text style={[styles.shareCardStatValue, { color: theme.text }]}>
              {formatListenDuration(snap.totalMs / 60_000)}
            </Text>
          </View>
          <View
            style={[styles.shareCardStatDivider, { backgroundColor: theme.subtext }]}
          />
          <View style={styles.shareCardStat}>
            <Text style={[styles.shareCardStatLabel, { color: theme.subtext }]}>
              {dict.STATS_STREAK_LONGEST}
            </Text>
            <Text style={[styles.shareCardStatValue, { color: theme.text }]}>
              {streakLabel}
            </Text>
          </View>
        </View>

        {covers.length > 0 ? (
          /* Strip left, logo bottom-right — one row, no dead band. */
          <View style={[styles.shareCardFooter, { justifyContent: "space-between" }]}>
            <View style={styles.shareCardRequests}>
              <Text style={[styles.shareCardStatLabel, { color: theme.subtext }]}>
                {dict.STATS_CARD_REQUESTS}
              </Text>
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
            <Image
              source={logoSource}
              style={styles.shareCardLogo}
              contentFit="contain"
            />
          </View>
        ) : (
          <View style={[styles.shareCardFooter, { justifyContent: "flex-end" }]}>
            <Image
              source={logoSource}
              style={styles.shareCardLogo}
              contentFit="contain"
            />
          </View>
        )}
      </View>
    </View>
  );
}
