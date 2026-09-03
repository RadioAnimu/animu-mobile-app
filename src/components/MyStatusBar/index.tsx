import { StatusBar, StatusBarProps, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "./styles";

interface MyStatusBarProps extends StatusBarProps {
  backgroundColor: string;
}

export const MyStatusBar = ({
  backgroundColor,
  ...props
}: MyStatusBarProps) => (
  <View style={[styles.statusBar, { backgroundColor }]}>
    <SafeAreaView edges={["top"]}>
      <StatusBar translucent backgroundColor={backgroundColor} {...props} />
    </SafeAreaView>
  </View>
);
