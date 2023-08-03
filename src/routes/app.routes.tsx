import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Home } from "../screens/Home";
import { MyPlayerProps } from "../utils";

interface HomeProps {}

export type RootStackParamList = {
  Home: HomeProps;
};

const { Navigator, Screen } = createNativeStackNavigator<RootStackParamList>();

export function AppRoutes() {
  return (
    <Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Screen name="Home" component={Home} />
    </Navigator>
  );
}
