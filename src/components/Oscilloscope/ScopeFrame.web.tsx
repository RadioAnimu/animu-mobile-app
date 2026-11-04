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
      // The sandboxed frame's origin is opaque, so no origin string can name
      // it: "*" is the only target that reaches it, and the window it goes to
      // is our own frame's. Only wave samples and their timing are sent.
      frame.current?.contentWindow?.postMessage(message, "*");
    },
  }), []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      // Only our frame: its window, and the opaque origin ("null") the sandbox gives it.
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      if (typeof event.data !== "string") return;
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
