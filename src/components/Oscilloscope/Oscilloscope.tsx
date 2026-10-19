import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import type { VisualizerWindow } from "@/core/player";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useIsFocused } from "@react-navigation/native";
import { THEME } from "@/theme";
import { CONFIG, debugLog } from "@/utils/player.config";
import { scale } from "@/theme/responsive";
import { styles } from "@/components/Oscilloscope/styles";

/**
 * Full strip the native container reserves for the scope (logo renders
 * around it) — the canvas is absolutely pinned to its vertical centre.
 * Geometry is authored at the 393pt reference and scaled with the logo so
 * the trace stays centred behind it on every device.
 */
const STRIP_HEIGHT = scale(127);
const CANVAS_HEIGHT = scale(75);
const CANVAS_TOP = scale(26);

type WebViewHandle = React.ComponentRef<typeof WebView>;

/**
 * Trace payload encoding: each waveform window becomes one hex digit pair
 * per point (`(value + 1) / 2 × 255`, i.e. 8-bit unsigned). ASCII-safe over
 * the WebView bridge and 2 bytes per point — a 1024-point window travels as
 * a ~2 KB string once per native decode window (~25 ms) and decodes with
 * direct nibble lookup.
 */
const WAVE_HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"));

// Same guarded clock as the sampler diagnostics: a missing `performance`
// global must never kill the wave delivery feed. (RN + Hermes has it; this
// is for exotic environments and unit tests.)
const perfNow = (): number => (typeof performance !== "undefined" ? performance.now() : 0);

function encodeWave(points: number[]): string {
  let hex = "";
  for (const point of points) {
    const byte = Math.max(0, Math.min(255, Math.round((point + 1) * 127.5)));
    // NaN keeps its legacy string form; finite bytes use the prebuilt table.
    hex += WAVE_HEX[byte] ?? byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * The embedded page — the web player's oscilloscope (`playerfiles/main5.js`
 * → `drawOscilloscope` + `updateWaveForm`), fed through the bridge instead
 * of a local audio element. One stream, zero playback: the app's player
 * stays the only audible path; this page receives the player's decoded PCM
 * windows over `postMessage` and draws them like `player.animu.moe` does.
 *
 * The site reads a fresh `AnalyserNode` window every animation frame: the
 * newest stretch of audio, advancing continuously with the audio clock. The
 * page reproduces that from the bridged windows. They are consecutive slices
 * of the decoded stream, so the queue is one continuous signal, and every
 * frame strokes the window-long stretch that starts at a read position on
 * that signal. The position moves with a clock (the measured window period),
 * held `delay` behind the newest window so the trace shows what is being
 * heard; when and how bursty the messages arrive no longer moves the trace.
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
      /* The canvas is pinned to the exact vertical centre of the strip the
         native container reserves for it, so no body-flow or zoom quirk of
         the embed can shift where the trace sits. */
      #oscilloscope { display: block; position: absolute; left: 0; top: ${CANVAS_TOP}px; z-index: 0; color: white; }
    </style>
  </head>
  <body>
    <canvas id="oscilloscope" width="0" height="0"></canvas>
    <script>
      // Diagnostics only: fixed-size counters, one report per five seconds.
      // No per-frame console calls, timers, or changes to rendering/pacing.
      var diagnosticsEnabled = ${CONFIG.DEBUG};
      var diagnosticStart = performance.now();
      var diagnosticLastFrame = 0;
      var diagnosticLastWave = 0;
      var diagnosticLastCursor = -1;
      function diagnosticCounters() {
        return { frames: 0, frameGapMaxMs: 0, framesOver25Ms: 0,
          drawMaxMs: 0, waves: 0, waveGapMaxMs: 0, burstWaves: 0,
          bridgeAgeMaxMs: 0, receiveMaxMs: 0, heldFrames: 0,
          underrunFrames: 0, fillingFrames: 0, slewedFrames: 0, resyncs: 0, waitingFrames: 0,
          lagErrorMaxMs: 0, queueMax: 0 };
      }
      var diagnostic = diagnosticCounters();

      // Decoded windows, oldest first. Serials are consecutive: the queue
      // holds (newestSerial - length + 1) .. newestSerial. Decoded PCM
      // reaches the bridge before the speaker plays it, so the trace reads
      // the queue by the delay (measured output latency) behind the newest window.
      var waveQueue = [];
      // The queue keeps the delay plus some slack, and never less than 80
      // windows (~2 s of a 26ms stream).
      var MIN_QUEUE = 80;
      var QUEUE_SLACK_WINDOWS = 8;
      var newestSerial = 0;
      var FLAT_WAVE = new Float32Array(1024);

      // Read clock: the schedule the windows are produced on, recovered from
      // their arrivals like a jitter buffer's clock. gridAt is when the
      // newest window was due, periodMs the spacing between windows. Both
      // start from the window's own PCM duration and follow the arrivals
      // through a slow two-gain loop, so one late or bunched message moves
      // the schedule by a fraction of its error.
      var GRID_GAIN = 0.1;
      var RATE_GAIN = 0.002;
      var gridAt = 0;
      var periodMs = 0;
      var nominalPeriodMs = 0;
      // A window this many periods behind schedule was held up on its way
      // (a stalled JS thread flushing its backlog at once): the schedule
      // stays put. Lateness that lasts RELOCK_WINDOWS periods of wall time
      // is the stream itself having paused, and the schedule restarts from
      // the arrivals.
      var LATE_WINDOWS = 4;
      var RELOCK_WINDOWS = 3;
      var lateSince = 0;
      var delayMs = 0;
      // Never read closer than this to the newest window: the margin that
      // absorbs arrival jitter when the platform reports little latency.
      var MIN_LAG_WINDOWS = 2;
      // Read position in window serials (fractional); -1 until placed.
      var cursor = -1;
      var lastFrameAt = 0;
      // Within this many windows of the schedule the cursor only speeds up or
      // slows down, by up to SLEW of its normal pace. Further behind (a
      // delivery stall's backlog arrived) it jumps ahead; further ahead (the
      // schedule moved later: a longer delay, a paused stream resuming) it
      // holds until the schedule catches up. It never steps back to replay
      // audio it already showed.
      var RESYNC_WINDOWS = 2;
      var SLEW = 0.5;
      // True while the queue does not reach back the full delay yet.
      // The delay is applied as requested (not rounded to whole windows), so
      // unlike the old crossfade nothing is reported back for calibration.
      var filling = true;

      function decode(hex) {
        var wave = new Float32Array(hex.length / 2);
        for (var i = 0; i < wave.length; i++) {
          var offset = i * 2;
          var high = hex.charCodeAt(offset);
          var low = hex.charCodeAt(offset + 1);
          var highIsLowerHex = (high >= 48 && high <= 57) || (high >= 97 && high <= 102);
          var lowIsLowerHex = (low >= 48 && low <= 57) || (low >= 97 && low <= 102);
          var byte = highIsLowerHex && lowIsLowerHex
            ? ((high <= 57 ? high - 48 : high - 87) << 4) |
              (low <= 57 ? low - 48 : low - 87)
            : parseInt(hex.substr(offset, 2), 16);
          wave[i] = byte / 127.5 - 1;
        }
        return wave;
      }

      function trackArrival(now, hintMs) {
        var nominal = Math.max(8, Math.min(80, hintMs > 0 ? hintMs : 26));
        if (!gridAt || Math.abs(nominal - nominalPeriodMs) > 0.25 * nominalPeriodMs) {
          // First window, or a different stream format: start a schedule.
          nominalPeriodMs = nominal;
          periodMs = nominal;
          gridAt = now;
          lateSince = 0;
          return;
        }
        var predicted = gridAt + periodMs;
        var error = now - predicted;
        if (error > LATE_WINDOWS * periodMs) {
          if (!lateSince) lateSince = now;
          if (now - lateSince < RELOCK_WINDOWS * periodMs) {
            gridAt = predicted;
            return;
          }
        }
        if (Math.abs(error) > LATE_WINDOWS * periodMs) {
          gridAt = now;
        } else {
          gridAt = predicted + error * GRID_GAIN;
          periodMs = Math.max(nominalPeriodMs * 0.5, Math.min(nominalPeriodMs * 2,
            periodMs + error * RATE_GAIN));
        }
        lateSince = 0;
      }

      function resetStream() {
        waveQueue = [];
        newestSerial = 0;
        gridAt = 0;
        periodMs = 0;
        nominalPeriodMs = 0;
        lateSince = 0;
        cursor = -1;
        lastFrameAt = 0;
        filling = true;
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
          var receivedAt = performance.now();
          if (diagnosticsEnabled) {
            var gap = diagnosticLastWave ? receivedAt - diagnosticLastWave : 0;
            diagnostic.waveGapMaxMs = Math.max(diagnostic.waveGapMaxMs, gap);
            if (gap > 0 && gap < 4) diagnostic.burstWaves++;
            diagnosticLastWave = receivedAt;
            diagnostic.waves++;
            diagnostic.bridgeAgeMaxMs = Math.max(diagnostic.bridgeAgeMaxMs,
              payload.diagnosticSentAt ? Date.now() - payload.diagnosticSentAt : 0);
          }
          waveQueue.push(decode(payload.wave));
          var queueLimit = Math.max(MIN_QUEUE,
            Math.ceil((payload.delay || 0) / (periodMs || 8)) + MIN_LAG_WINDOWS + QUEUE_SLACK_WINDOWS);
          while (waveQueue.length > queueLimit) waveQueue.shift();
          newestSerial++;
          delayMs = payload.delay || 0;
          trackArrival(receivedAt, payload.duration || payload.interval);
          if (diagnosticsEnabled) {
            diagnostic.queueMax = Math.max(diagnostic.queueMax, waveQueue.length);
            diagnostic.receiveMaxMs = Math.max(diagnostic.receiveMaxMs,
              performance.now() - receivedAt);
          }
        }
        if (payload.type === 'stop') {
          resetStream();
          invalidateStroke();
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

      // Moves the read position to frameAt; false while nothing has arrived.
      function advanceCursor(frameAt) {
        if (!newestSerial) return false;
        var lagMs = Math.max(delayMs, MIN_LAG_WINDOWS * periodMs);
        var desired = newestSerial + (frameAt - gridAt) / periodMs - lagMs / periodMs;
        var step = lastFrameAt ? Math.max(0, frameAt - lastFrameAt) / periodMs : 0;
        lastFrameAt = frameAt;
        var ahead = desired - cursor;
        if (cursor >= 0 && (lateSince || ahead - step < -RESYNC_WINDOWS)) {
          // Wait: while arrivals run late (a backlog flush or a paused
          // stream, not told apart yet) the stale schedule would chase
          // windows nobody hears yet; and a schedule that moved later is
          // waited for rather than replayed.
          if (diagnosticsEnabled) diagnostic.waitingFrames++;
        } else if (cursor < 0 || ahead - step > RESYNC_WINDOWS) {
          cursor = desired;
          if (diagnosticsEnabled && !filling) diagnostic.resyncs++;
        } else {
          var advance = Math.max(step * (1 - SLEW), Math.min(step * (1 + SLEW), ahead));
          if (diagnosticsEnabled && advance !== ahead) diagnostic.slewedFrames++;
          cursor += advance;
        }
        var oldest = newestSerial - waveQueue.length + 1;
        filling = desired < oldest;
        if (diagnosticsEnabled && filling) diagnostic.fillingFrames++;
        if (cursor < oldest) {
          cursor = oldest;
        } else if (cursor > newestSerial) {
          cursor = newestSerial;
          if (diagnosticsEnabled) diagnostic.underrunFrames++;
        }
        if (diagnosticsEnabled && !filling) {
          diagnostic.lagErrorMaxMs = Math.max(diagnostic.lagErrorMaxMs,
            Math.abs(desired - cursor) * periodMs);
        }
        return true;
      }

      var scopeCanvas = document.getElementById('oscilloscope');
      var scopeContext = scopeCanvas.getContext('2d', { alpha: true });
      var lastStrokeFirst = null;
      var lastStrokeSecond = null;
      var lastStrokeOffset = -1;
      var lastStrokeWidth = -1;
      var lastStrokeHeight = -1;
      // The canvas bitmap is managed by the compositor, not by JS state: a
      // surface/layer teardown, trim, or page restore can drop those pixels
      // while every JS-observable value (windows, size, offset) stays the
      // same. Lifecycle events therefore drop the cached-stroke assumption
      // so the next frame repaints the actual canvas.
      function invalidateStroke() {
        lastStrokeFirst = null;
        lastStrokeSecond = null;
        lastStrokeOffset = -1;
      }
      document.addEventListener('visibilitychange', invalidateStroke);
      window.addEventListener('pageshow', invalidateStroke);
      window.addEventListener('resize', invalidateStroke);
      // Stroke state is constant; the context only loses it when the canvas
      // bitmap is resized (per spec), so it is applied once and re-applied
      // after each resize instead of on every stroke.
      var STROKE_STYLE = '${STROKE_COLOR}';
      function applyStrokeStyles() {
        scopeContext.strokeStyle = STROKE_STYLE;
        scopeContext.lineWidth = 3;
        scopeContext.lineJoin = 'round';
        scopeContext.lineCap = 'round';
      }
      applyStrokeStyles();
      function finishFrameDiagnostics(frameAt, didStroke) {
        if (!diagnosticsEnabled) return;
        if (didStroke) {
          diagnostic.drawMaxMs = Math.max(diagnostic.drawMaxMs, performance.now() - frameAt);
        }
        if (frameAt - diagnosticStart >= 5000) {
          postToNative({ type: 'diagnostic', elapsedMs: frameAt - diagnosticStart,
            at: Date.now(), stats: diagnostic, periodMs: periodMs, delayMs: delayMs,
            visibility: document.visibilityState });
          diagnostic = diagnosticCounters();
          diagnosticStart = frameAt;
        }
      }
      function drawOscilloscope(frameAt) {
        requestAnimationFrame(drawOscilloscope);
        // The vsync timestamp paces the read position (evenly spaced, like
        // the display); the first call has none.
        frameAt = frameAt || performance.now();
        var hasWave = advanceCursor(frameAt);
        if (diagnosticsEnabled) {
          var frameGap = diagnosticLastFrame ? frameAt - diagnosticLastFrame : 0;
          diagnosticLastFrame = frameAt;
          diagnostic.frames++;
          diagnostic.frameGapMaxMs = Math.max(diagnostic.frameGapMaxMs, frameGap);
          if (frameGap > 25) diagnostic.framesOver25Ms++;
          if (hasWave && cursor === diagnosticLastCursor) diagnostic.heldFrames++;
          diagnosticLastCursor = cursor;
        }

        // Identical to the web player: CSS-pixel canvas, 1x, compositor
        // handles upscaling on hi-DPI phones.
        var canvasWidth = Math.floor(window.innerWidth);
        var canvasHeight = Math.floor(${CANVAS_HEIGHT});
        if (scopeCanvas.width !== canvasWidth) {
          scopeCanvas.width = canvasWidth;
          applyStrokeStyles();
        }
        if (scopeCanvas.height !== canvasHeight) {
          scopeCanvas.height = canvasHeight;
          applyStrokeStyles();
        }

        // The stroke covers one window's worth of points starting at the
        // read position: the tail of window floor(cursor) followed by the
        // head of the next one.
        var first = FLAT_WAVE;
        var second = FLAT_WAVE;
        var offset = 0;
        if (hasWave) {
          var base = Math.floor(cursor);
          var index = base - (newestSerial - waveQueue.length + 1);
          first = waveQueue[index];
          offset = Math.floor((cursor - base) * first.length);
          // cursor <= newestSerial, so a partial offset always has a next window.
          second = offset > 0 ? waveQueue[Math.min(index + 1, waveQueue.length - 1)] : first;
        }
        // Nothing moved since the last stroke (no new audio to show yet):
        // its pixels are still exactly right.
        if (first === lastStrokeFirst && second === lastStrokeSecond && offset === lastStrokeOffset &&
            canvasWidth === lastStrokeWidth && canvasHeight === lastStrokeHeight) {
          finishFrameDiagnostics(frameAt, false);
          return;
        }

        scopeContext.clearRect(0, 0, canvasWidth, canvasHeight);
        scopeContext.beginPath();
        // Per-frame invariants hoisted out of the loop.
        var xStep = canvasWidth / 1000;
        var length = first.length;
        // Decimate the polyline toward ~1.5 vertices per CSS pixel (stride 2
        // on 273–455px-wide phones, none on wider screens). That halves the
        // path the WebView's GPU thread rasterises per stroke (measured
        // 27→40 fps on a software-GPU emulator). Peaks stay within ~1.5px,
        // but a lone one-sample spike on a skipped index is not drawn, so
        // dense passages read slightly smoother than with every point.
        // The final vertex is pinned so the stroke still reaches the end of
        // the window; set stride to 1 to draw every point.
        var stride = canvasWidth > 0 ? Math.max(1, Math.round(length / (canvasWidth * 1.5))) : 1;
        for (var i = 0; i < length; i += stride) {
          var source = offset + i;
          var value = source < length ? first[source] : second[source - length];
          var y = (0.5 + value / 2) * canvasHeight;
          if (i === 0) {
            scopeContext.moveTo(i * xStep, y);
          } else {
            scopeContext.lineTo(i * xStep, y);
          }
        }
        var lastVertex = length - 1;
        if (length > 0 && lastVertex % stride) {
          var lastSource = offset + lastVertex;
          var lastValue = lastSource < length ? first[lastSource] : second[lastSource - length];
          scopeContext.lineTo(lastVertex * xStep, (0.5 + lastValue / 2) * canvasHeight);
        }

        scopeContext.stroke();
        lastStrokeFirst = first;
        lastStrokeSecond = second;
        lastStrokeOffset = offset;
        lastStrokeWidth = canvasWidth;
        lastStrokeHeight = canvasHeight;
        finishFrameDiagnostics(frameAt, true);
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
 * player's own draw loop* — a window-long stretch of the decoded stream,
 * read on an audio-paced clock and stroked once per display vsync through
 * a GPU-backed canvas.
 * Same renderer class (`canvas` + `requestAnimationFrame`), same geometry,
 * same technique as `player.animu.moe`.
 *
 * The WebView is transparent, pinned to the exact 127px strip the native
 * container reserves (the canvas is centered inside it on the browser
 * side) and pointer-transparent — it renders, nothing else. `react-freeze`
 * pauses it while backgrounded.
 */
/** One source object for the page's lifetime (a new one per render is prop churn). */
const PAGE_SOURCE = { html: PAGE_HTML };

export const Oscilloscope = React.memo(function Oscilloscope() {
  const {
    subscribeVisualizerWindows,
    isPlaying,
    visualizerSupported,
  } = usePlayer();
  const { settings } = useUserSettings();
  const isBackgrounded = useIsBackgrounded();
  // The scope only lives on Home (a drawer screen that stays mounted while
  // other screens are in front of it): sampling must stop when it is not
  // the screen the user is actually looking at.
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();

  const diagnosticRef = useRef({ start: 0, last: 0, waves: 0, gapMaxMs: 0, encodePostMaxMs: 0 });
  const webviewRef = useRef<WebViewHandle | null>(null);
  /** Whether the embedded page has announced itself through the bridge. */
  const pageReadyRef = useRef(false);
  /** Monotonic bridge message counter (dedupe guard across platforms). */
  const bridgeSeqRef = useRef(0);
  /** Bumped to remount the WebView after its renderer process died. */
  const [pageKey, setPageKey] = useState(0);
  const samplingWanted =
    isPlaying && visualizerSupported && settings.visualizerHz > 0;
  const wantsOn = isFocused && samplingWanted && !isBackgrounded;


  // Commit logs expose context-driven renders without adding React state.
  useEffect(() => {
    if (!CONFIG.DEBUG) return;
    debugLog("[ScopeDiag] commit", { at: Date.now(), wantsOn, width,
      isPlaying, isBackgrounded, visualizerHz: settings.visualizerHz });
  });
  // The WebView only exists while wantsOn: once it is gone, the next one is
  // a fresh page that must announce itself again before it is told to stop.
  useEffect(() => {
    if (!wantsOn) pageReadyRef.current = false;
  }, [wantsOn]);
  useEffect(() => {
    debugLog("[ScopeDiag] mount", Date.now());
    return () => debugLog("[ScopeDiag] unmount", Date.now());
  }, []);

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
      // Same guarded clock as the sampler diagnostics: the post path must
      // never die because an environment lacks `performance`.
      const started = CONFIG.DEBUG ? perfNow() : 0;
      post({
        ...(CONFIG.DEBUG ? { diagnosticSentAt: Date.now() } : {}),
        type: "wave",
        wave: encodeWave(window.targetWave),
        interval: window.nativeIntervalMs,
        delay: window.outputLatencyMs,
        duration: window.windowMs,
      });
      if (CONFIG.DEBUG) {
        const d = diagnosticRef.current;
        if (!d.start) d.start = started;
        d.gapMaxMs = Math.max(d.gapMaxMs, d.last ? started - d.last : 0);
        d.last = started;
        d.waves++;
        d.encodePostMaxMs = Math.max(d.encodePostMaxMs, perfNow() - started);
        if (started - d.start >= 5000) {
          debugLog("[ScopeDiag] RN", { at: Date.now(), ...d,
            elapsedMs: started - d.start, pageReady: pageReadyRef.current,
            hasWebView: !!webviewRef.current });
          diagnosticRef.current = { start: started, last: started, waves: 0, gapMaxMs: 0, encodePostMaxMs: 0 };
        }
      }
    },
    [post],
  );

  // ── Data passthrough: raw windows → the embedded draw loop ──
  // The bridge only carries the *newest* window (~2 KB); the page queues them
  // into one continuous signal and paces its own read position.
  useEffect(() => {
    if (!wantsOn) return undefined;
    debugLog("[ScopeDiag] subscribe", Date.now());
    const unsubscribe = subscribeVisualizerWindows(receiveWindow);
    return () => {
      debugLog("[ScopeDiag] unsubscribe", Date.now());
      unsubscribe();
      if (pageReadyRef.current) {
        post({ type: "stop" });
      }
    };
  }, [wantsOn, subscribeVisualizerWindows, receiveWindow, post]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      // Readiness announcement (and debug diagnostics) from the embedded page.
      try {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload?.type === "ready") {
          debugLog("[ScopeDiag] page-ready", Date.now());
          pageReadyRef.current = true;
          return;
        }
        if (payload?.type === "diagnostic") {
          debugLog("[ScopeDiag] WebView", payload);
        }
      } catch {
        // Non-JSON bridge chatter — ignore.
      }
    },
    [],
  );

  // A killed or crashed renderer leaves a dead WebView behind (the library
  // only keeps the app alive): remount a fresh page in its place.
  const onRenderProcessGone = useCallback(() => {
    debugLog("[ScopeDiag] render-process-gone", Date.now());
    pageReadyRef.current = false;
    setPageKey((key) => key + 1);
  }, []);

  if (!wantsOn) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* The WebView *is* the 127px strip: nesting it inside the old 75px
          `canvas` view double-offset the trace (wrapper centred the 127px
          viewport 26px down, then the page offset the canvas another 26px). */}
      <WebView
        key={pageKey}
        ref={webviewRef}
        source={PAGE_SOURCE}
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
        style={{ width, height: STRIP_HEIGHT, backgroundColor: "transparent" }}
      />
    </View>
  );
});
