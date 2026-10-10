import { useMemo, type ReactNode } from "react";
import { FlatList, Text, View, type ListRenderItem } from "react-native";
import type { LineLabel } from "@/core/lyrics/pronunciation";
import { keyedLines } from "@/core/lyrics/lrc";
import { SegmentColumns } from "@/screens/Lyrics/Segments";
import { styles } from "@/screens/Lyrics/styles";

interface Props {
  lines: readonly string[];
  /** The reading under each line (`null` for none). */
  labels: readonly (LineLabel | null)[];
  /** Shown above the lyrics (why they are not synced). */
  notice?: string;
  footer: ReactNode;
}

type Row = { key: string; text: string; label: LineLabel | null };

const renderRow: ListRenderItem<Row> = ({ item }) => {
  if (!item.text) return <View style={styles.stanzaGap} />;
  if (item.label?.kind === "words") {
    return (
      <View style={styles.plainRow}>
        <SegmentColumns segments={item.label.segments} textStyle={styles.plainLine} />
      </View>
    );
  }
  return (
    <View style={styles.plainRow}>
      <Text maxFontSizeMultiplier={1.6} style={styles.plainLine}>
        {item.text}
      </Text>
      {item.label ? <Text style={styles.label}>{item.label.text}</Text> : null}
    </View>
  );
};

/** Untimed lyrics: a static, freely scrolled page (blank lines are stanza gaps). */
export function PlainLyrics({ lines, labels, notice, footer }: Readonly<Props>) {
  const rows = useMemo(
    () => keyedLines(lines).map((row, index) => ({ ...row, label: labels[index] ?? null })),
    [lines, labels],
  );
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={[styles.column, styles.plainContent]}
      ListHeaderComponent={notice ? <Text style={styles.notice}>{notice}</Text> : null}
      ListFooterComponent={<>{footer}</>}
      renderItem={renderRow}
    />
  );
}
