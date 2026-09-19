import React, { useCallback, useEffect, useRef } from "react";
import { View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import type { VisualizerWindow } from "@/core/player";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { THEME } from "@/theme";
import { styles } from "@/components/Oscilloscope/styles";

/**
 * Full strip the native container reserves for the scope (logo renders
 * around it) — the canvas is absolutely pinned to its vertical centre.
 */
const STRIP_HEIGHT = 127;

type WebViewHandle = React.ComponentRef<typeof WebView>;

/**
 * Trace payload encoding: each waveform window becomes one hex digit pair
 * per point (`(value + 1) / 2 × 255`, i.e. 8-bit unsigned). ASCII-safe over
 * the WebView bridge and 2 bytes per point — a 1024-point window travels as
 * a ~2 KB string once per native decode window (~25 ms) and decodes with a
 * single `parseInt` pass.
 */
function encodeWave(points: number[]): string {
  let hex = "";
  for (let i = 0; i < points.length; i++) {
    const byte = Math.max(0, Math.min(255, Math.round((points[i] + 1) * 127.5)));
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * The embedded page — the web player's own oscilloscope loop
 * (`playerfiles/main5.js` → `drawOscilloscope` + `updateWaveForm`), fed
 * through the bridge instead of a local audio element. One stream, zero
 * playback: the app's expo-audio player stays the only audible path; this
 * page receives the player's decoded PCM windows over `postMessage` and
 * renders them exactly like `player.animu.moe` does — ` AnalyserNode`-style
 * interpolation between windows (over their measured cadence) and one
 * canvas `stroke()` per `requestAnimationFrame` (device vsync).
 */
// Trace stroke color — single source of truth in the theme (the web player
// hardcodes the same hex in `player.animu.moe`'s stylesheet).
const STROKE_COLOR = THEME.COLORS.VISUALIZER;

const PAGE_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
      /* The 75px canvas is pinned to the exact vertical centre of the 127px
         strip the native container reserves for it, so no body-flow or
         zoom quirk of the embed can shift where the trace sits. */
      #oscilloscope { display: block; position: absolute; left: 0; top: 26px; z-index: 0; color: white; }
    </style>
  </head>
  <body>
    <canvas id="oscilloscope" width="0" height="0"></canvas>
    <script>
      var previousWave = new Float32Array(1024);
      var targetWave = new Float32Array(1024);
      var windowAt = 0;
      var intervalMs = 16;
      // Decoded PCM reaches the bridge before the speaker has played it, so
      // the trace is delayed back through this queue by the measured output
      // latency (payload.delay). That keeps the scope on the audio the
      // listener is actually hearing.
      var waveQueue = [];
      var MAX_QUEUE = 80;
      // Delay actually applied to the newest window, reported back to the
      // sampler so it can auto-calibrate the residual sync error.
      var appliedDelayMs = 0;

      // Send the applied delay back to RN, but at most ~2x/second — the
      // calibration is slow-moving and the bridge is the expensive part.
      var lastReportAt = 0;
      function reportAppliedDelay() {
        var now = performance.now();
        if (now - lastReportAt < 500) return;
        lastReportAt = now;
        postToNative({ type: 'applied', delay: appliedDelayMs });
      }

      function decode(hex) {
        var wave = new Float32Array(hex.length / 2);
        for (var i = 0; i < wave.length; i++) {
          wave[i] = parseInt(hex.substr(i * 2, 2), 16) / 127.5 - 1;
        }
        return wave;
      }

      // RN webview delivers ref.postMessage per platform: on iOS it fires on
      // the window, on Android on the document. Listen on both; the seq
      // guard makes a double delivery a no-op.
      var lastSeq = 0;
      function onBridgeEvent(event) {
        receiveWindow(event.data);
      }
      function receiveWindow(message) {
        var payload;
        try { payload = JSON.parse(message); } catch (error) { return; }
        if (payload.seq !== undefined) {
          if (payload.seq <= lastSeq) return;
          lastSeq = payload.seq;
        }
        if (payload.type === 'wave') {
          var next = decode(payload.wave);
          waveQueue.push(next);
          if (waveQueue.length > MAX_QUEUE) waveQueue.shift();
          intervalMs = payload.interval || intervalMs;
          var delayMs = payload.delay || 0;
          // Step delayMs back through the queue. One frame is subtracted
          // because the previous -> target interpolation already trails the
          // newest window by one interval. Clamp so a bad measurement can
          // neither skip ahead nor blank the trace.
          var delayFrames = Math.round(delayMs / intervalMs) - 1;
          if (delayFrames < 0) delayFrames = 0;
          if (delayFrames > waveQueue.length - 1) delayFrames = waveQueue.length - 1;
          var targetIndex = waveQueue.length - 1 - delayFrames;
          targetWave = waveQueue[targetIndex];
          previousWave = targetIndex > 0 ? waveQueue[targetIndex - 1] : targetWave;
          windowAt = performance.now();
          // Quantised delay we truly applied; JS compares it with the
          // measured latency and trims the difference automatically.
          appliedDelayMs = (delayFrames + 1) * intervalMs;
          reportAppliedDelay();
        }
        if (payload.type === 'stop') {
          waveQueue = [];
          previousWave = new Float32Array(1024);
          targetWave = new Float32Array(1024);
          windowAt = 0;
        }
      }
      // Android WebView delivers RN postMessage on the document; iOS on
      // window — the seq guard above makes the overlap harmless.
      document.addEventListener('message', onBridgeEvent);
      window.addEventListener('message', onBridgeEvent);
      // Announce readiness to RN (the injectable bridge object), not to the
      // page itself — RN onMessage only sees ReactNativeWebView messages.
      function postToNative(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }
      postToNative({ type: 'ready' });

      function drawOscilloscope() {
        requestAnimationFrame(drawOscilloscope);

        var scopeCanvas = document.getElementById('oscilloscope');
        var scopeContext = scopeCanvas.getContext('2d', { alpha: true });
        // Identical to the web player: CSS-pixel canvas, 1x, compositor
        // handles upscaling on hi-DPI phones.
        scopeCanvas.width = window.innerWidth;
        scopeCanvas.height = 75;

        scopeContext.clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);
        scopeContext.beginPath();

        var t = Math.max(0, Math.min(1, (performance.now() - windowAt) / intervalMs));
        for (var i = 0; i < targetWave.length; i++) {
          var x = i * (scopeCanvas.width / 1000);
          var value = previousWave[i] + (targetWave[i] - previousWave[i]) * t;
          var y = (0.5 + value / 2) * scopeCanvas.height;
          if (i === 0) {
            scopeContext.moveTo(x, y);
          } else {
            scopeContext.lineTo(x, y);
          }
        }

        scopeContext.strokeStyle = '${STROKE_COLOR}';
        scopeContext.lineWidth = 3;
        scopeContext.lineJoin = 'round';
        scopeContext.lineCap = 'round';
        scopeContext.stroke();

      }
      drawOscilloscope();
    </script>
  </body>
</html>`;

/**
 * Home oscilloscope (Android) — passthrough engine.
 *
 * No second audio stream and no RN-side per-frame work: the player's
 * existing native PCM tap (expo-audio patch) hands each decoded window to
 * this WebView as a tiny hex payload, and the embedded page runs the *web
 * player's own draw loop* — interpolating between consecutive windows and
 * stroking the trace once per display vsync through a GPU-backed canvas.
 * Same renderer class (`canvas` + `requestAnimationFrame`), same geometry,
 * same technique as `player.animu.moe`.
 *
 * The WebView is transparent, pinned to the exact 127px strip the native
 * container reserves (the canvas is centered inside it on the browser
 * side) and pointer-transparent — it renders, nothing else. `react-freeze`
 * pauses it while backgrounded.
 */
export const Oscilloscope = React.memo(function Oscilloscope() {
  const {
    subscribeVisualizerWindows,
    reportVisualizerDelay,
    isPlaying,
    visualizerSupported,
  } = usePlayer();
  const { settings } = useUserSettings();
  const isBackgrounded = useIsBackgrounded();
  const { width } = useWindowDimensions();

  const webviewRef = useRef<WebViewHandle | null>(null);
  /** Whether the embedded page has announced itself through the bridge. */
  const pageReadyRef = useRef(false);
  /** Monotonic bridge message counter (dedupe guard across platforms). */
  const bridgeSeqRef = useRef(0);
  const wantsOn =
    isPlaying &&
    visualizerSupported &&
    settings.visualizerHz > 0 &&
    !isBackgrounded;


  const post = useCallback(
    (payload: object) => {
      // Each bridge message carries a monotonic seq — the embedded page
      // ignores replays (some platforms deliver to both window and document).
      bridgeSeqRef.current += 1;
      webviewRef.current?.postMessage(
        JSON.stringify({ ...payload, seq: bridgeSeqRef.current }),
      );
    },
    [],
  );

  const receiveWindow = useCallback(
    (window: VisualizerWindow) => {
      post({
        type: "wave",
        wave: encodeWave(window.targetWave),
        interval: window.nativeIntervalMs,
        delay: window.outputLatencyMs,
      });
    },
    [post],
  );

  // ── Data passthrough: raw windows → the embedded draw loop ──
  // The bridge only carries the *newest* window; the page keeps the last one
  // and interpolates between the two, so each message is ~2 KB.
  useEffect(() => {
    if (!wantsOn) return;
    const unsubscribe = subscribeVisualizerWindows(receiveWindow);
    return () => {
      unsubscribe();
      if (pageReadyRef.current) {
        post({ type: "stop" });
      }
    };
  }, [wantsOn, subscribeVisualizerWindows, receiveWindow, post]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      // Auto-sync feedback + readiness announcement from the embedded page.
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload?.type === "ready") {
          pageReadyRef.current = true;
          return;
        }
        if (payload?.type === "applied" && typeof payload.delay === "number") {
          reportVisualizerDelay(payload.delay);
        }
      } catch {
        // Non-JSON bridge chatter — ignore.
      }
    },
    [reportVisualizerDelay],
  );

  if (!wantsOn) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* The WebView *is* the 127px strip: nesting it inside the old 75px
          `canvas` view double-offset the trace (wrapper centred the 127px
          viewport 26px down, then the page offset the canvas another 26px). */}
      <WebView
        ref={webviewRef}
        source={{ html: PAGE_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled={false}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        androidLayerType="hardware"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        style={{ width, height: STRIP_HEIGHT, backgroundColor: "transparent" }}
      />
    </View>
  );
});
