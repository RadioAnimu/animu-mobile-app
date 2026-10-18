import { Icon } from "@/components/Icon";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { KeyboardScrollView } from "@/components/KeyboardScrollView";

import type { RecentSearch } from "@/core/services/recent-searches.service";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { formatResultCount, interpolate } from "@/utils/format";
import { layoutEase } from "@/utils/layout-animation";
import { findMatchRange } from "@/utils/search-match";
import { styles } from "@/screens/MakeRequest/styles";

/** The query with the typed part emphasized, so a match reads at a glance. */
function HighlightedQuery({
  query,
  typed,
}: Readonly<{ query: string; typed?: string }>) {
  const range = typed ? findMatchRange(query, typed) : null;
  if (!range) return <>{query}</>;
  return (
    <>
      {query.slice(0, range.start)}
      <Text style={styles.recentMatch}>
        {query.slice(range.start, range.end)}
      </Text>
      {query.slice(range.end)}
    </>
  );
}

function RecentRow({
  dict,
  item,
  typed,
  onPick,
  onEdit,
  onRemove,
}: Readonly<{
  dict: Dict;
  item: RecentSearch;
  typed?: string;
  onPick: (query: string) => void;
  onEdit: (query: string) => void;
  onRemove: (query: string) => void;
}>) {
  // Legacy entries (saved before counts were kept) show no count.
  const count =
    item.total === null ? null : formatResultCount(item.total, dict);

  return (
    <View style={styles.recentRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={count ? `${item.query}, ${count}` : item.query}
        activeOpacity={THEME.OPACITY.PRESSED}
        onPress={() => onPick(item.query)}
        style={styles.recentPick}
      >
        <Icon
          name="history"
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
        <View style={styles.recentLabel}>
          <Text style={styles.recentText} numberOfLines={1}>
            <HighlightedQuery query={item.query} typed={typed} />
          </Text>
          {count && (
            <Text style={styles.recentCount} numberOfLines={1}>
              ({count})
            </Text>
          )}
        </View>
      </TouchableOpacity>
      {/* Copies the query into the field (keyboard stays up) to refine it
          instead of re-running it as is. */}
      <TouchableOpacity
        activeOpacity={THEME.OPACITY.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={`${dict.REQUEST_SEARCH_RECENT_EDIT}: ${item.query}`}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={() => onEdit(item.query)}
        style={styles.recentAction}
      >
        <Icon
          name="north-west"
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={THEME.OPACITY.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={`${dict.REQUEST_SEARCH_RECENT_REMOVE}: ${item.query}`}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={() => onRemove(item.query)}
        style={[styles.recentAction, styles.recentActionLast]}
      >
        <Icon name="close" size={THEME.ICON.MD} color={THEME.COLORS.TEXT_DIM} />
      </TouchableOpacity>
    </View>
  );
}

/** How many entries show before "Show all" (and the most shown while typing). */
export const RECENT_SHOWN = 10;

/**
 * Past searches with their result counts. With an empty field it lists the
 * latest `RECENT_SHOWN` (the rest one "Show all" away), so a repeat search is
 * one tap instead of a full retype; while typing (`typed`) it shows the best
 * matches from the whole history under a row that runs the typed text, so an
 * earlier search surfaces before it is re-run and a new one is never a dead
 * end.
 *
 * Scrolls inside the room left above the keyboard and, unlike the results,
 * keeps the keyboard up while dragged — browsing these is part of typing.
 */
export function RecentSearches({
  dict,
  items,
  typed,
  onRunTyped,
  onPick,
  onEdit,
  onRemove,
  onClear,
  bottomPadding,
}: Readonly<{
  dict: Dict;
  /** The whole history, or the ranked matches for `typed`. */
  items: RecentSearch[];
  /** Text being typed; set when `items` are the matches for it. */
  typed?: string;
  /** Runs `typed` — offered once it is long enough to search. */
  onRunTyped?: () => void;
  onPick: (query: string) => void;
  onEdit: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  bottomPadding: number;
}>) {
  const filtering = Boolean(typed);
  // Starts collapsed each time the panel comes back.
  const [expanded, setExpanded] = useState(false);
  const canExpand = !filtering && items.length > RECENT_SHOWN;
  const shown = canExpand && expanded ? items : items.slice(0, RECENT_SHOWN);

  return (
    <KeyboardScrollView
      variant="list"
      style={styles.recent}
      keyboardDismissMode="none"
    >
      {typed && onRunTyped && (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={THEME.OPACITY.PRESSED}
          onPress={onRunTyped}
          style={[styles.recentRow, styles.recentPick, styles.recentRun]}
        >
          <Icon name="search" size={THEME.ICON.MD} color={THEME.COLORS.BRAND} />
          <Text style={styles.recentText} numberOfLines={1}>
            {interpolate(dict.REQUEST_SEARCH_RUN, { query: typed })}
          </Text>
        </TouchableOpacity>
      )}

      {shown.length > 0 && (
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>
            {filtering
              ? dict.REQUEST_SEARCH_RECENT_MATCHES
              : dict.REQUEST_SEARCH_RECENT}
          </Text>
          {/* Clearing everything is a full-list decision, not a typing one. */}
          {!filtering && (
            <TouchableOpacity
              activeOpacity={THEME.OPACITY.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={dict.REQUEST_SEARCH_RECENT_CLEAR}
              hitSlop={THEME.HIT_SLOP.SM}
              onPress={onClear}
            >
              <Text style={styles.recentClear}>
                {dict.REQUEST_SEARCH_RECENT_CLEAR}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View>
        {shown.map((item, index) => (
          <View key={item.query}>
            {index > 0 && <View style={styles.recentDivider} />}
            <RecentRow
              dict={dict}
              item={item}
              typed={typed}
              onPick={onPick}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          </View>
        ))}
      </View>

      {canExpand && (
        <TouchableOpacity
          activeOpacity={THEME.OPACITY.PRESSED}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={THEME.HIT_SLOP.SM}
          onPress={() => {
            layoutEase();
            setExpanded((value) => !value);
          }}
          style={styles.recentMore}
        >
          <Text style={styles.recentClear}>
            {expanded
              ? dict.REQUEST_SEARCH_RECENT_SHOW_LESS
              : interpolate(dict.REQUEST_SEARCH_RECENT_SHOW_ALL, {
                  n: items.length,
                })}
          </Text>
        </TouchableOpacity>
      )}
      {/* Clears the home indicator. */}
      <View style={{ height: bottomPadding }} />
    </KeyboardScrollView>
  );
}
