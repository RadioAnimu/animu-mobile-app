import { Linking as RNLinking } from "react-native";
import * as ExpoLinking from "expo-linking";

/**
 * Actions a deep link can ask the app to perform:
 *
 *   animuapp://assistant/play
 *
 * Siri, Google Assistant and cars play natively through the voice catalog;
 * this route serves links opened from elsewhere (a user's own shortcut).
 */
export type AssistantAction = "play";

const ASSISTANT_HOST = "assistant";
const PLAY_PATH = "play";

/**
 * Strips leading and trailing slashes in one linear pass. A
 * `/^\/+|\/+$/g` regex is quadratic on long slash runs followed by another
 * character, and this input is an externally supplied URL.
 */
function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;
  return value.slice(start, end);
}

export function parseAssistantUrl(url: string | null): AssistantAction | null {
  if (!url) return null;

  const parsed = ExpoLinking.parse(url);
  if (parsed.hostname !== ASSISTANT_HOST) return null;

  // `animuapp://assistant/play` → path "play"; `animuapp://assistant` → null.
  const path = trimSlashes(parsed.path ?? "");
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
