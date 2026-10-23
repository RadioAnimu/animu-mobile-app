const { withMainActivity } = require("expo/config-plugins");

const MARKER = "// @generated animu-focus-ring";
const IMPORT_LINES = [
  "import android.graphics.Rect",
  "import android.graphics.drawable.Drawable",
  "import android.graphics.drawable.GradientDrawable",
  "import android.graphics.drawable.LayerDrawable",
  "import android.os.SystemClock",
  "import android.view.KeyEvent",
  "import android.view.View",
  "import android.view.ViewGroup",
  "import android.webkit.WebView",
  "import android.widget.EditText",
  "import kotlin.math.abs",
];
const IMPORTS_ANCHOR = "import android.os.Bundle";
const ON_CREATE_ANCHOR = /(\n(\s*)super\.onCreate\((?:null|savedInstanceState)\)\n)/;
const METHODS_ANCHOR = /(\n\s*override fun getMainComponentName)/;

/** THEME.COLORS.BRAND — the ring is the app's green, as on the website. */
const RING_COLOR = "0xFF6BDB00";
/** A faint lift inside the ring, so a focused glyph reads as "selected". */
const RING_FILL = "0x1FFFFFFF";

const FOCUS_RING =
  `  ${MARKER}\n` +
  "  // React Native draws no focus state: its views skip View.draw(), so the\n" +
  "  // platform's default focus highlight never shows, and TouchableOpacity\n" +
  "  // drops focus events outside react-native-tvos. With a D-pad (Android TV,\n" +
  "  // a keyboard on a tablet) the focused control gets a ring as its\n" +
  "  // foreground — brand green outside, white inside, so it reads on the\n" +
  "  // purple surfaces and the green pills alike — drawn a little outside the\n" +
  "  // control so small icons stay legible. Touch input never shows it.\n" +
  "  private var focusRingView: View? = null\n" +
  "  private var focusRingPrevious: Drawable? = null\n" +
  "  private var focusRing: Drawable? = null\n" +
  "  /**\n" +
  "   * When an arrow key last went down: tells a D-pad move from focus taken by a\n" +
  "   * view that just mounted (Select on play starts playback, which mounts the\n" +
  "   * oscilloscope — that must not count as heading anywhere).\n" +
  "   */\n" +
  "  private var lastArrowDownAt = 0L\n\n" +
  "  override fun dispatchKeyEvent(event: KeyEvent): Boolean {\n" +
  "    if (event.action == KeyEvent.ACTION_DOWN && event.keyCode in ARROW_KEYS) {\n" +
  "      lastArrowDownAt = SystemClock.uptimeMillis()\n" +
  "    }\n" +
  "    return super.dispatchKeyEvent(event)\n" +
  "  }\n\n" +
  "  private fun installFocusRing() {\n" +
  "    val density = resources.displayMetrics.density\n" +
  "    val outset = (5 * density).toInt()\n" +
  "    val stroke = (3 * density).toInt()\n" +
  "    val green = GradientDrawable().apply {\n" +
  `      setColor(${RING_FILL}.toInt())\n` +
  `      setStroke(stroke, ${RING_COLOR}.toInt())\n` +
  "      cornerRadius = 14 * density\n" +
  "    }\n" +
  "    val white = GradientDrawable().apply {\n" +
  "      setStroke(maxOf(1, (1.5f * density).toInt()), 0xFFFFFFFF.toInt())\n" +
  "      cornerRadius = 11 * density\n" +
  "    }\n" +
  "    val ring = LayerDrawable(arrayOf<Drawable>(green, white)).apply {\n" +
  "      setLayerInset(0, -outset, -outset, -outset, -outset)\n" +
  "      setLayerInset(1, stroke - outset, stroke - outset, stroke - outset, stroke - outset)\n" +
  "    }\n" +
  "    focusRing = ring\n" +
  "    val observer = window.decorView.viewTreeObserver\n" +
  "    observer.addOnGlobalFocusChangeListener { previous, focused -> showFocusRing(focused, previous) }\n" +
  "    // Focus can land while the window is not the one in front (a dialog or a\n" +
  "    // system overlay on top at launch) or while still in touch mode: the\n" +
  "    // control that holds focus gets its ring as soon as the window is back in\n" +
  "    // front, or on the first D-pad press, which leaves touch mode.\n" +
  "    observer.addOnTouchModeChangeListener { inTouchMode ->\n" +
  "      if (inTouchMode) clearFocusRing() else showFocusRing(currentFocus, null)\n" +
  "    }\n" +
  "    observer.addOnWindowFocusChangeListener { hasFocus ->\n" +
  "      if (hasFocus) showFocusRing(currentFocus, null)\n" +
  "    }\n" +
  "  }\n\n" +
  "  private fun showFocusRing(focused: View?, previous: View?) {\n" +
  "    clearFocusRing()\n" +
  "    val ring = focusRing ?: return\n" +
  "    if (focused == null || focused.isInTouchMode) return\n" +
  "    val webView = enclosingWebView(focused)\n" +
  "    if (webView != null) {\n" +
  "      skipDecorativeWebView(webView, previous)\n" +
  "    } else if (focused !is EditText) {\n" +
  "      focusRingPrevious = focused.foreground\n" +
  "      focused.foreground = ring\n" +
  "      focusRingView = focused\n" +
  "    }\n" +
  "  }\n\n" +
  "  private fun clearFocusRing() {\n" +
  "    focusRingView?.foreground = focusRingPrevious\n" +
  "    focusRingView = null\n" +
  "    focusRingPrevious = null\n" +
  "  }\n\n" +
  "  private fun enclosingWebView(view: View): WebView? {\n" +
  "    var node: View? = view\n" +
  "    while (node != null) {\n" +
  "      if (node is WebView) return node\n" +
  "      node = node.parent as? View\n" +
  "    }\n" +
  "    return null\n" +
  "  }\n\n" +
  "  // The app's only WebView is the oscilloscope drawn behind the logo: pure\n" +
  "  // decoration, never a D-pad stop. It is made unfocusable; focus moves on in\n" +
  "  // the direction the user was heading, or — when the WebView took focus by\n" +
  "  // mounting (playback starting), not by a key — goes back where it was.\n" +
  "  private fun skipDecorativeWebView(webView: WebView, from: View?) {\n" +
  "    webView.isFocusable = false\n" +
  "    webView.isFocusableInTouchMode = false\n" +
  "    webView.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS\n" +
  "    // Nowhere to continue from (focus was already inside it when the window\n" +
  "    // came back): clearing focus outside touch mode hands it to the first\n" +
  "    // eligible control instead of leaving it stranded in the page.\n" +
  "    if (from == null || from === webView) {\n" +
  "      webView.post { webView.findFocus()?.clearFocus() ?: webView.clearFocus() }\n" +
  "      return\n" +
  "    }\n" +
  "    if (SystemClock.uptimeMillis() - lastArrowDownAt > KEY_FOCUS_WINDOW_MS) {\n" +
  "      webView.post { from.requestFocus() }\n" +
  "      return\n" +
  "    }\n" +
  "    val a = Rect()\n" +
  "    val b = Rect()\n" +
  "    from.getGlobalVisibleRect(a)\n" +
  "    webView.getGlobalVisibleRect(b)\n" +
  "    val dx = b.centerX() - a.centerX()\n" +
  "    val dy = b.centerY() - a.centerY()\n" +
  "    val direction = if (abs(dy) >= abs(dx)) {\n" +
  "      if (dy < 0) View.FOCUS_UP else View.FOCUS_DOWN\n" +
  "    } else {\n" +
  "      if (dx < 0) View.FOCUS_LEFT else View.FOCUS_RIGHT\n" +
  "    }\n" +
  "    webView.post { (from.focusSearch(direction) ?: from).requestFocus() }\n" +
  "  }\n\n" +
  "  // A focus change this soon after an arrow key was caused by it.\n" +
  "  private val KEY_FOCUS_WINDOW_MS = 300L\n" +
  "  private val ARROW_KEYS = setOf(\n" +
  "    KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,\n" +
  "    KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT,\n" +
  "  )\n";

function addFocusRing(contents) {
  if (contents.includes(MARKER)) return contents;
  if (!contents.includes(IMPORTS_ANCHOR)) {
    throw new Error("MainActivity.kt is missing the expected import anchor: " + IMPORTS_ANCHOR);
  }
  if (!ON_CREATE_ANCHOR.test(contents)) {
    throw new Error("MainActivity.kt is missing the expected super.onCreate(...) anchor");
  }
  if (!METHODS_ANCHOR.test(contents)) {
    throw new Error("MainActivity.kt is missing the expected getMainComponentName anchor");
  }
  const imports = IMPORT_LINES.filter((line) => !contents.includes(line));
  if (imports.length) contents = contents.replace(IMPORTS_ANCHOR, `${imports.join("\n")}\n${IMPORTS_ANCHOR}`);
  return contents
    .replace(ON_CREATE_ANCHOR, "$1$2installFocusRing()\n")
    .replace(METHODS_ANCHOR, `\n${FOCUS_RING}$1`);
}

module.exports = function withAndroidFocusRing(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== "kt") return config;
    config.modResults.contents = addFocusRing(config.modResults.contents);
    return config;
  });
};
module.exports.addFocusRing = addFocusRing;
