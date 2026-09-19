import { NavigationContainer } from "@react-navigation/native";
import { AppRoutes } from "@/routes/app.routes";

export function Routes() {
  return (
    <NavigationContainer>
      <AppRoutes />
    </NavigationContainer>
  );
}
