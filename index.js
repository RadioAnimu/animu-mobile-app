import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";
import App from "@app/App";

// Keep the native splash up until the JS splash (same artwork) has painted,
// so the handoff is seamless — no gray flash and no double splash. Best
// effort: a platform that refuses it must not surface an unhandled rejection.
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 250 });

registerRootComponent(App);
