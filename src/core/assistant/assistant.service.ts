import { Linking as RNLinking } from "react-native";
import * as ExpoLinking from "expo-linking";

/**
 * Actions the phone assistants (Siri App Shortcuts / Google App Actions) can
 * ask the app to perform by opening a deep link.
 *
 *   animuapp://assistant/play
 *
 * The native side (see `plugins/withIOSAppIntents.js` and
 * `plugins/withAndroidAppActions.js`) always forwards to this one route, so a
 * new assistant phrase only needs a UI tweak there — the JS contract stays.
 */
export type AssistantAction = "play";

const ASSISTANT_HOST = "assistant";
const PLAY_PATH = "play";

export function parseAssistantUrl(url: string | null): AssistantAction | null {
  if (!url) return null;

  const parsed = ExpoLinking.parse(url);
  if (parsed.hostname !== ASSISTANT_HOST) return null;

  // `animuapp://assistant/play` → path "play"; `animuapp://assistant` → null.
  const path = (parsed.path ?? "").replace(/^\/+|\/+$/g, "");
  if (path === "" || path === PLAY_PATH) return "play";
  return null;
}

/**
 * Subscribes to assistant invocations, including the cold-start link that
 * launched the app. Returns an unsubscribe function.
 */
export function subscribeAssistantActions(
  handler: (action: AssistantAction) => void,
): () => void {
  const onUrl = ({ url }: { url: string }) => {
    const action = parseAssistantUrl(url);
    if (action) handler(action);
  };

  const subscription = RNLinking.addEventListener("url", onUrl);

  // The cold-start URL resolves asynchronously; a teardown before it does must
  // not fire the handler (and must not double-fire with the "url" event).
  let cancelled = false;
  void RNLinking.getInitialURL()
    .then((url) => {
      if (cancelled) return;
      const action = parseAssistantUrl(url);
      if (action) handler(action);
    })
    .catch((error) => {
      console.warn("[Assistant] getInitialURL failed:", error);
    });

  return () => {
    cancelled = true;
    subscription.remove();
  };
}
