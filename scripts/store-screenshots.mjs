#!/usr/bin/env node
// Composes the store screenshots: a caption over the brand gradient and the
// raw capture framed as a device.
//
//   node scripts/store-screenshots.mjs <raw-dir> [locale...] [--target play|iphone|ipad]
//
// --target play (default): Google Play phone, 1080x1920 (9:16), written to
//   store/google-play/<locale>/images/phoneScreenshots/<n>.jpg.
// --target iphone: App Store 6.9" iPhone, 1320x2868, from iPhone 16 Pro Max
//   captures; --target ipad: App Store 13" iPad, 2064x2752, from iPad Pro 13"
//   captures. Both are written to store/app-store/<locale>/<target>/<n>.jpg.
//
// <raw-dir> holds one folder per app UI language (pt, en, es, ja), each with
// the device captures named after `shots` in store/google-play/screenshots.json.
// A capture missing from a language folder falls back to `pt` (the lyrics
// screen has no UI text, so it is shared).
//
// Japanese captions need a CJK font: set CJK_FONT to a bold one (e.g. Noto Sans
// CJK JP Bold); otherwise the Droid fallback font is used if installed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "store/google-play");
const FONTS = path.join(ROOT, "src/assets/fonts");
const JPEG_QUALITY = 92;

// Canvas size and layout per store. `phone` is the framed capture's top, height,
// corner radius and bezel; `glow` the green glow's centre height and radius.
const TARGETS = {
  play: { W: 1080, H: 1920, font: 72, lineHeight: 84, top: [210, 165], textInset: 140, phone: { y: 350, h: 1500, r: 56, bezel: 14 }, glow: [1150, 700] },
  iphone: { W: 1320, H: 2868, font: 92, lineHeight: 108, top: [300, 245], textInset: 170, phone: { y: 480, h: 2240, r: 120, bezel: 18 }, glow: [1700, 950] },
  ipad: { W: 2064, H: 2752, font: 120, lineHeight: 140, top: [300, 240], textInset: 400, phone: { y: 470, h: 2130, r: 36, bezel: 22 }, glow: [1550, 1300] },
};

const args = process.argv.slice(2);
const targetAt = args.indexOf("--target");
const target = targetAt >= 0 ? args.splice(targetAt, 2)[1] : "play";
const T = TARGETS[target];
if (!T) {
  console.error(`unknown --target ${target} (play, iphone or ipad)`);
  process.exit(1);
}
const { W, H } = T;
const [rawDir, ...only] = args;
if (!rawDir) {
  console.error(
    "usage: node scripts/store-screenshots.mjs <raw-dir> [locale...] [--target play|iphone|ipad]",
  );
  process.exit(1);
}

GlobalFonts.registerFromPath(
  path.join(FONTS, "proximanova-bold.ttf"),
  "PNBold",
);
const cjkFont = [
  process.env.CJK_FONT,
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
].find((f) => f && fs.existsSync(f));
if (cjkFont) GlobalFonts.registerFromPath(cjkFont, "CJK");

const { shots, uiLanguage, captions } = JSON.parse(
  fs.readFileSync(path.join(STORE, "screenshots.json"), "utf8"),
);

// Latin words stay whole; CJK text may break between any two characters, so
// Japanese captions mark their break with an explicit "\n".
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    const tokens = paragraph.match(/[\p{Script=Latin}\d'’.,!?:;&/+-]+|\s+|./gu);
    let cur = "";
    for (const t of tokens) {
      const next = cur + t;
      if (ctx.measureText(next.trimEnd()).width > maxW && cur.trim()) {
        lines.push(cur.trimEnd());
        cur = t.trimStart();
      } else cur = next;
    }
    if (cur.trim()) lines.push(cur.trimEnd());
  }
  return lines;
}

async function compose(capture, caption, locale) {
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#3d0f8a");
  bg.addColorStop(0.55, "#22064f");
  bg.addColorStop(1, "#12022b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Soft green glow behind the phone.
  const glow = ctx.createRadialGradient(W / 2, T.glow[0], 50, W / 2, T.glow[0], T.glow[1]);
  glow.addColorStop(0, "rgba(109,219,0,0.22)");
  glow.addColorStop(1, "rgba(109,219,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Japanese uses the CJK font for its Latin words too, so a caption doesn't
  // mix two typefaces.
  // Two lines is all the space above the phone: a caption that needs more
  // shrinks, down to 80% of the target's size.
  let lines;
  for (let size = T.font; ; size -= 2) {
    ctx.font = locale.startsWith("ja") ? `${size}px CJK` : `${size}px PNBold, CJK`;
    lines = wrap(ctx, caption, W - T.textInset);
    if (lines.length <= 2) break;
    if (size <= T.font * 0.8)
      throw new Error(`${locale}: caption too long: ${caption}`);
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const { lineHeight } = T;
  const top = lines.length === 1 ? T.top[0] : T.top[1];
  lines.forEach((l, k) => ctx.fillText(l, W / 2, top + k * lineHeight));
  ctx.fillStyle = "#6ddb00";
  ctx.beginPath();
  // The bar under the caption scales with the font (120x10 at Play's 72px).
  const bar = { w: Math.round((T.font * 5) / 3), h: Math.round(T.font / 7.2) };
  ctx.roundRect(
    W / 2 - bar.w / 2,
    top + (lines.length - 1) * lineHeight + Math.round(T.font * 0.528),
    bar.w,
    bar.h,
    bar.h / 2,
  );
  ctx.fill();

  const img = await loadImage(fs.readFileSync(capture));
  const { y, h: ph, r, bezel } = T.phone;
  const pw = Math.round(img.width * (ph / img.height));
  const x = Math.round((W - pw) / 2);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = "#0b0118";
  ctx.beginPath();
  ctx.roundRect(
    x - bezel,
    y - bezel,
    pw + 2 * bezel,
    ph + 2 * bezel,
    r + bezel,
  );
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, r);
  ctx.clip();
  ctx.drawImage(img, x, y, pw, ph);
  ctx.restore();
  return c.encode("jpeg", JPEG_QUALITY);
}

for (const [locale, texts] of Object.entries(captions)) {
  if (only.length && !only.includes(locale)) continue;
  const outDir =
    target === "play"
      ? path.join(STORE, locale, "images/phoneScreenshots")
      : path.join(ROOT, "store/app-store", locale, target);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, f));
  for (const [i, shot] of shots.entries()) {
    const own = path.join(rawDir, uiLanguage[locale], `${shot}.png`);
    const capture = fs.existsSync(own)
      ? own
      : path.join(rawDir, "pt", `${shot}.png`);
    const out = path.join(outDir, `${i + 1}.jpg`);
    fs.writeFileSync(out, await compose(capture, texts[i], locale));
    console.log(
      path.relative(ROOT, out),
      capture === own ? "" : "(pt capture)",
    );
  }
}
