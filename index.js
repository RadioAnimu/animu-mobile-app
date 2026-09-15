import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";
import App from "./App";

// Keep the native splash up until the JS splash (same artwork) has painted,
// so the handoff is seamless — no gray flash and no double splash.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

registerRootComponent(App);
