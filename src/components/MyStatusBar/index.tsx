import { View, StatusBar, SafeAreaView, StatusBarProps } from "react-native";
import { styles } from "./styles";

interface MyStatusBarProps extends StatusBarProps {
  backgroundColor: string;
}

export const MyStatusBar = ({
  backgroundColor,
  ...props
}: MyStatusBarProps) => (
  <View style={[styles.statusBar, { backgroundColor }]}>
    <SafeAreaView>
      <StatusBar translucent backgroundColor={backgroundColor} {...props} />
    </SafeAreaView>
  </View>
);
