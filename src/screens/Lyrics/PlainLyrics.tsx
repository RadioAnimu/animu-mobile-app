import { useMemo, type ReactNode } from "react";
import { FlatList, Text, View, type ListRenderItem } from "react-native";
import { keyedLines } from "@/core/lyrics/lrc";
import { styles } from "@/screens/Lyrics/styles";

interface Props {
  lines: readonly string[];
  /** Pronunciation label per line (`""` for none). */
  labels: readonly string[];
  /** Shown above the lyrics (why they are not synced). */
  notice?: string;
  footer: ReactNode;
}

type Row = { key: string; text: string; label: string };

const renderRow: ListRenderItem<Row> = ({ item }) =>
  item.text ? (
    <View style={styles.plainRow}>
      <Text maxFontSizeMultiplier={1.6} style={styles.plainLine}>
        {item.text}
      </Text>
      {item.label ? <Text style={styles.label}>{item.label}</Text> : null}
    </View>
  ) : (
    <View style={styles.stanzaGap} />
  );

/** Untimed lyrics: a static, freely scrolled page (blank lines are stanza gaps). */
export function PlainLyrics({ lines, labels, notice, footer }: Readonly<Props>) {
  const rows = useMemo(
    () => keyedLines(lines).map((row, index) => ({ ...row, label: labels[index] ?? "" })),
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
