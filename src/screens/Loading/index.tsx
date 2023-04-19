import { ActivityIndicator } from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { SafeAreaView } from "react-native-safe-area-context";
import { Background } from "../../components/Background";

export function Loading() {
  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={THEME.COLORS.PRIMARY} />
      </SafeAreaView>
    </Background>
  );
}
