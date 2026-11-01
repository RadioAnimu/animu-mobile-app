import { forwardRef, useImperativeHandle, useRef } from "react";
import { WebView } from "react-native-webview";

export interface ScopeFrameHandle {
  postMessage(message: string): void;
}

export interface ScopeFrameProps {
  html: string;
  width: number;
  height: number;
  /** A message the page posted (`ready`, debug diagnostics). */
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  /** Native: the page's renderer process died; the caller remounts a fresh one. */
  onRenderProcessGone: () => void;
}

/** The surface the scope page runs in: a transparent, inert WebView. */
export const ScopeFrame = forwardRef<ScopeFrameHandle, ScopeFrameProps>(function ScopeFrame(
  { html, width, height, onMessage, onRenderProcessGone },
  ref,
) {
  const webview = useRef<React.ComponentRef<typeof WebView> | null>(null);
  useImperativeHandle(ref, () => ({
    postMessage(message: string) {
      webview.current?.postMessage(message);
    },
  }), []);
  return (
    <WebView
      ref={webview}
      source={{ html }}
      onMessage={onMessage}
      onRenderProcessGone={onRenderProcessGone}
      javaScriptEnabled
      domStorageEnabled={false}
      originWhitelist={["*"]}
      mediaPlaybackRequiresUserAction={false}
      mixedContentMode="always"
      androidLayerType="hardware"
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ width, height, backgroundColor: "transparent" }}
    />
  );
});
