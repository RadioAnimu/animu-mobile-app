#!/usr/bin/env node
// Android TV home-screen banner (320×180 px, drawable-xhdpi): the app logo
// centered on the app's surface purple. Regenerate after a logo change with
// `node scripts/generate-tv-banner.mjs`; the output is committed and copied
// into the native project by plugins/withAndroidTV.js.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_FILE = path.join(ROOT, "src/assets/logo_PT.webp");
const OUT_FILE = path.join(ROOT, "assets/tv-banner.png");

const WIDTH = 320;
const HEIGHT = 180;
/** THEME.COLORS.SURFACE — the header bar / drawer tone. */
const BACKGROUND = "#270052";
/** The logo's ink spans this much of the banner at most. */
const MAX_INK_WIDTH = 0.8;
const MAX_INK_HEIGHT = 0.7;

/** Bounding box of the non-transparent pixels. */
function inkBounds(image) {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  let left = image.width;
  let top = image.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const logo = await loadImage(LOGO_FILE);
const ink = inkBounds(logo);
const fit = Math.min((WIDTH * MAX_INK_WIDTH) / ink.width, (HEIGHT * MAX_INK_HEIGHT) / ink.height);
const drawWidth = ink.width * fit;
const drawHeight = ink.height * fit;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
ctx.fillStyle = BACKGROUND;
ctx.fillRect(0, 0, WIDTH, HEIGHT);
ctx.drawImage(
  logo,
  ink.left,
  ink.top,
  ink.width,
  ink.height,
  (WIDTH - drawWidth) / 2,
  (HEIGHT - drawHeight) / 2,
  drawWidth,
  drawHeight,
);
fs.writeFileSync(OUT_FILE, canvas.toBuffer("image/png"));
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${WIDTH}×${HEIGHT})`);
