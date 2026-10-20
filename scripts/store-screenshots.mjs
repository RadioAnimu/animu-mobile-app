#!/usr/bin/env node
// Composes the Google Play phone screenshots: a caption over the brand
// gradient and the raw emulator capture framed as a phone, 1080x1920 (9:16).
//
//   node scripts/store-screenshots.mjs <raw-dir> [locale...]
//
// <raw-dir> holds one folder per app UI language (pt, en, es, ja), each with
// the 1080x2400 captures named after `shots` in store/google-play/screenshots.json.
// A capture missing from a language folder falls back to `pt` (the lyrics
// screen has no UI text, so it is shared). Output goes to
// store/google-play/<locale>/images/phoneScreenshots/<n>.jpg.
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
const W = 1080;
const H = 1920;
const JPEG_QUALITY = 92;

const [rawDir, ...only] = process.argv.slice(2);
if (!rawDir) {
  console.error(
    "usage: node scripts/store-screenshots.mjs <raw-dir> [locale...]",
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
  const glow = ctx.createRadialGradient(W / 2, 1150, 50, W / 2, 1150, 700);
  glow.addColorStop(0, "rgba(109,219,0,0.22)");
  glow.addColorStop(1, "rgba(109,219,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Japanese uses the CJK font for its Latin words too, so a caption doesn't
  // mix two typefaces.
  ctx.font = locale.startsWith("ja") ? "72px CJK" : "72px PNBold, CJK";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const lines = wrap(ctx, caption, W - 140);
  // Two lines is all the space above the phone.
  if (lines.length > 2)
    throw new Error(`${locale}: caption too long: ${caption}`);
  const lineHeight = 84;
  const top = lines.length === 1 ? 210 : 165;
  lines.forEach((l, k) => ctx.fillText(l, W / 2, top + k * lineHeight));
  ctx.fillStyle = "#6ddb00";
  ctx.beginPath();
  ctx.roundRect(
    W / 2 - 60,
    top + (lines.length - 1) * lineHeight + 38,
    120,
    10,
    5,
  );
  ctx.fill();

  const img = await loadImage(fs.readFileSync(capture));
  const ph = 1500;
  const pw = Math.round(img.width * (ph / img.height));
  const x = Math.round((W - pw) / 2);
  const y = 350;
  const r = 56;
  const bezel = 14;
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
  const outDir = path.join(STORE, locale, "images/phoneScreenshots");
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
