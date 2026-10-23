import { vi } from "vitest";

/**
 * Runs the oscilloscope's embedded page script (the `<script>` of the
 * WebView HTML) against a recording 2D context, a manual clock and a fake
 * bridge, so tests can drive arrivals and display frames deterministically.
 */
export type Command = [string, ...unknown[]];

export interface PageState {
  cursor: number;
  newestSerial: number;
  periodMs: number;
  filling: boolean;
}

type Listener = (event: { data: string }) => void;

export function loadPage(html: string, width = 320.8, height = 127) {
  const widthAssignments: number[] = [];
  const heightAssignments: number[] = [];
  let canvasWidth = 0;
  let canvasHeight = 0;
  const commands: Command[] = [];
  const state = { strokeStyle: "#000", lineWidth: 1, lineJoin: "miter", lineCap: "butt" };
  // Per spec, assigning a canvas dimension resets the context state.
  const resetContext = () =>
    Object.assign(state, { strokeStyle: "#000", lineWidth: 1, lineJoin: "miter", lineCap: "butt" });
  const context = {
    clearRect: (...args: number[]) => commands.push(["clearRect", ...args]),
    beginPath: () => commands.push(["beginPath"]),
    moveTo: (...args: number[]) => commands.push(["moveTo", ...args]),
    lineTo: (...args: number[]) => commands.push(["lineTo", ...args]),
    stroke: () => commands.push(["stroke", state.strokeStyle, state.lineWidth, state.lineJoin, state.lineCap]),
    set strokeStyle(value: string) { state.strokeStyle = value; commands.push(["strokeStyle", value]); },
    set lineWidth(value: number) { state.lineWidth = value; commands.push(["lineWidth", value]); },
    set lineJoin(value: string) { state.lineJoin = value; commands.push(["lineJoin", value]); },
    set lineCap(value: string) { state.lineCap = value; commands.push(["lineCap", value]); },
  };
  const canvasStyle = { top: "" };
  const canvas = {
    style: canvasStyle,
    get width() { return canvasWidth; },
    set width(value: number) { canvasWidth = value; widthAssignments.push(value); resetContext(); },
    get height() { return canvasHeight; },
    set height(value: number) { canvasHeight = value; heightAssignments.push(value); resetContext(); },
    getContext: vi.fn(() => context),
  };
  const clock = { now: 0 };
  let frameCallback: ((at?: number) => void) | undefined;
  const listeners: Record<string, Listener> = {};
  const nativeMessages: Record<string, unknown>[] = [];
  const pageWindow = {
    innerWidth: width,
    innerHeight: height,
    addEventListener: (name: string, callback: Listener) => { listeners[name] = callback; },
    ReactNativeWebView: { postMessage: (value: string) => nativeMessages.push(JSON.parse(value)) },
  };
  const pageDocument = {
    getElementById: vi.fn(() => canvas),
    addEventListener: (name: string, callback: Listener) => { listeners[name] = callback; },
    visibilityState: "visible",
  };
  // The page has exactly one inline script, written by us in lower case.
  const open = html.indexOf("<script>");
  const close = html.indexOf("</script>", open);
  if (open < 0 || close < 0) throw new Error("page script not found");
  const script = html.slice(open + "<script>".length, close);
  // Read-only accessor for the page's pacing state, appended to the script.
  const peek = new Function(
    "window", "document", "performance", "requestAnimationFrame", "Date",
    `${script}
    return function () {
      return { cursor: cursor, newestSerial: newestSerial, periodMs: periodMs,
        filling: filling };
    };`,
  )(
    pageWindow,
    pageDocument,
    { now: () => clock.now },
    (callback: (at?: number) => void) => { frameCallback = callback; },
    { now: () => clock.now },
  ) as () => PageState;

  let seq = 0;
  const send = (payload: Record<string, unknown>) =>
    listeners.message({ data: JSON.stringify({ seq: ++seq, ...payload }) });
  return {
    canvas,
    commands,
    widthAssignments,
    heightAssignments,
    clock,
    listeners,
    nativeMessages,
    pageWindow,
    pageDocument,
    peek,
    send,
    /** Delivers one wave message at the current clock. */
    wave: (hex: string, extra: Record<string, unknown> = {}) =>
      send({ type: "wave", wave: hex, interval: 25, duration: 25, delay: 0, ...extra }),
    /** Runs one display frame (at `at`, or the current clock). */
    frame: (at?: number) => {
      if (at !== undefined) clock.now = at;
      frameCallback!();
    },
    strokes: () => commands.filter(([name]) => name === "stroke").length,
    vertices: () =>
      commands
        .filter(([name]) => name === "moveTo" || name === "lineTo")
        .map(([, x, y]) => [x, y] as [number, number]),
  };
}

export type Page = ReturnType<typeof loadPage>;

/** Window `serial` filled with one byte value, so the trace reveals which window it shows. */
const windowHex = (serial: number) => ((serial % 200) + 1).toString(16).padStart(2, "0").repeat(1024);

/**
 * Plays wave arrivals (ms timestamps, one window each, serials from 1)
 * against a 60 Hz display until `until`, returning the read position after
 * every frame.
 */
export function play(
  page: Page,
  arrivals: number[],
  delay: number,
  until: number,
  extra: Record<string, unknown> = {},
) {
  const frames: ({ at: number } & PageState)[] = [];
  let next = 0;
  for (let at = page.clock.now; at <= until; at += 1000 / 60) {
    while (next < arrivals.length && arrivals[next] <= at) {
      page.clock.now = arrivals[next];
      page.wave(windowHex(next + 1), { delay, ...extra });
      next++;
    }
    page.frame(at);
    frames.push({ at, ...page.peek() });
  }
  return frames;
}
