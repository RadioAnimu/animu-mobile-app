import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  type ListRenderItem,
} from "react-native";

import type { MusicRequest } from "@/core/domain/music-request";
import { THEME } from "@/theme";
import { styles } from "@/screens/MakeRequest/styles";

interface Props {
  listRef: React.RefObject<FlatList<MusicRequest> | null>;
  data: MusicRequest[];
  renderItem: ListRenderItem<MusicRequest>;
  /** Whether the "nothing matched" label should show. */
  showEmpty: boolean;
  emptyLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
  /** A next page is in flight — shows the footer spinner. */
  loadingMore: boolean;
  onEndReached: () => void;
}

/**
 * The search results list: pull-to-refresh, endless scroll, keyboard-friendly
 * touch handling, and virtualization tuning for long (200+ row) searches.
 */
export function ResultsList({
  listRef,
  data,
  renderItem,
  showEmpty,
  emptyLabel,
  refreshing,
  onRefresh,
  loadingMore,
  onEndReached,
}: Props) {
  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={renderItem}
      // Tapping a result right after searching acts on the row immediately —
      // the keyboard does not swallow the first tap.
      keyboardShouldPersistTaps="handled"
      // Scrolling results dismisses the keyboard to free the view.
      keyboardDismissMode="on-drag"
      // Rows wrap to show the full title, so they vary in height and cannot
      // be described by `getItemLayout`. Render only what is on screen plus a
      // short lead in/out.
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      ListEmptyComponent={
        showEmpty ? <Text style={styles.emptyText}>{emptyLabel}</Text> : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={THEME.COLORS.TEXT}
          colors={[THEME.COLORS.BRAND]}
          progressBackgroundColor={THEME.COLORS.SURFACE}
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            color={THEME.COLORS.TEXT}
            style={styles.loadMoreSpinner}
          />
        ) : null
      }
      // Endless scroll: fetch the next page as the user nears the end. The
      // handler is re-entrancy-guarded and a no-op when there is no next page.
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
    />
  );
}
