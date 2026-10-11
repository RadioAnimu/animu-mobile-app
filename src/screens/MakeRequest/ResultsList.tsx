import {
  ActivityIndicator,
  FlatList,
  Text,
  type ListRenderItem,
  type ScrollViewProps,
} from "react-native";

import { AppRefreshControl } from "@/components/AppRefreshControl";
import { KeyboardScrollView } from "@/components/KeyboardScrollView";

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
  /** Clears the home indicator / nav bar. */
  bottomPadding: number;
}

// Module-level so the list keeps one scroll component identity.
const renderScrollComponent = (props: ScrollViewProps) => (
  <KeyboardScrollView {...props} />
);

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
  bottomPadding,
}: Readonly<Props>) {
  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
      // Keeps the last rows reachable above the keyboard on both platforms;
      // a tapped result acts immediately (the keyboard doesn't swallow the
      // tap) and dragging the results dismisses the keyboard.
      renderScrollComponent={renderScrollComponent}
      renderItem={renderItem}
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
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            color={THEME.COLORS.SPINNER}
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
