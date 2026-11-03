import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ScopeFrameHandle, ScopeFrameProps } from "@/components/Oscilloscope/ScopeFrame";

/**
 * Web build: the scope page runs in a sandboxed `srcdoc` iframe (scripts
 * only, opaque origin) — the same page and the same `postMessage` protocol
 * as the native WebView.
 */
export const ScopeFrame = forwardRef<ScopeFrameHandle, ScopeFrameProps>(function ScopeFrame(
  { html, width, height, onMessage },
  ref,
) {
  const frame = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    postMessage(message: string) {
      frame.current?.contentWindow?.postMessage(message, "*");
    },
  }), []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== "string") return;
      onMessage({ nativeEvent: { data: event.data } });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onMessage]);

  return (
    <iframe
      ref={frame}
      srcDoc={html}
      sandbox="allow-scripts"
      title="oscilloscope"
      aria-hidden
      tabIndex={-1}
      style={{ width, height, border: 0, background: "transparent", display: "block", pointerEvents: "none" }}
    />
  );
});
