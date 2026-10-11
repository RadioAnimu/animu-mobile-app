import React, { Fragment } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";

import { Icon } from "@/components/Icon";
import type { Dict } from "@/i18n";
import { styles } from "@/screens/Stats/styles";
import { THEME } from "@/theme";
import { interpolate } from "@/utils/format";

/** One ranked row: cover, title, optional subtitle and its request count. */
export interface TopItem {
  key: string;
  title: string;
  subtitle?: string;
  art: string;
  count: number;
}

/**
 * Ranked list card (stats.fm / Last.fm style) of the listener's most
 * requested songs: rank, cover, title over a dim subtitle and the request
 * count on the right. An empty ranking invites the first request.
 */
export function TopList({
  items,
  dict,
}: Readonly<{ items: TopItem[]; dict: Dict }>) {
  if (items.length === 0) {
    return (
      <View style={[styles.group, styles.topEmpty]}>
        <Text style={styles.caption}>{dict.STATS_TOP_REQUESTS_EMPTY}</Text>
      </View>
    );
  }
  return (
    <View style={styles.group}>
      {items.map((item, index) => {
        const count =
          item.count === 1
            ? dict.STATS_REQUEST_ONE
            : interpolate(dict.STATS_REQUESTS_N, { n: item.count });
        return (
          <Fragment key={item.key}>
            {index > 0 && <View style={styles.topDivider} />}
            <View
              accessible
              accessibilityLabel={[`${index + 1}. ${item.title}`, item.subtitle, count]
                .filter(Boolean)
                .join(", ")}
              style={styles.topRow}
            >
              <Text
                style={[styles.topRank, index === 0 && styles.topRankFirst]}
              >
                {index + 1}
              </Text>
              <View style={styles.topCover}>
                {item.art ? (
                  <Image
                    source={{ uri: item.art }}
                    style={styles.topCoverImage}
                    contentFit="cover"
                    recyclingKey={item.art}
                  />
                ) : (
                  <Icon
                    name="music-note"
                    size={THEME.ICON.SM}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                )}
              </View>
              <View style={styles.topText}>
                <Text numberOfLines={1} style={styles.topTitle}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={styles.caption}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.topPlays}>{count}</Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
