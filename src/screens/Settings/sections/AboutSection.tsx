import { version } from "@app/package.json";
import { useDict } from "@/hooks/useDict";
import { ValueRow } from "@/screens/Settings/rows";

interface Props {
  onPress: () => void;
}

/** Entry row to the About screen: versions, credits, donors, licensing. */
export function AboutSection({ onPress }: Props) {
  const dict = useDict();

  return (
    <ValueRow
      icon="info"
      label={dict.SETTINGS_ABOUT_ROW}
      value={`v${version}`}
      onPress={onPress}
    />
  );
}
