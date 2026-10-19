#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const ART_FILE = path.join(ROOT, "assets/splash_top.png");
// The in-app Loading screen shows the same art as a (much smaller) WebP; it
// is written from the same canvas so the two can never show different
// versions.
const WEBP_FILE = path.join(ROOT, "assets/splash_top.webp");
const WEBP_QUALITY = 90;
const FONT_FILE = path.join(ROOT, "src/assets/fonts/proximanova-bold.ttf");

const FONT_SIZE = Number(process.env.SPLASH_FONT_SIZE ?? 60);
const ERASE_TOP = 560;
const ERASE_BOTTOM = 658;
const TEXT_CENTER_Y = 595;

// Mode colour of a row of RGBA pixels, as `#rrggbb`. The band is painted with
// the artwork's own background rather than the plugin config colour, which is
// a shade off and would leave a visible seam. Alpha is ignored.
export function dominantColor(rgbaData) {
  const counts = new Map();
  let best = 0;
  let color = 0;
  for (let i = 0; i < rgbaData.length; i += 4) {
    const rgb = (rgbaData[i] << 16) | (rgbaData[i + 1] << 8) | rgbaData[i + 2];
    const count = (counts.get(rgb) ?? 0) + 1;
    counts.set(rgb, count);
    if (count > best) {
      best = count;
      color = rgb;
    }
  }
  return `#${color.toString(16).padStart(6, "0")}`;
}

async function main() {
  const app = readJson(path.join(ROOT, "app.json")).expo;
  const pkg = readJson(path.join(ROOT, "package.json"));
  const version = app.version ?? pkg.version;
  const label = process.env.SPLASH_LABEL ?? `v${version}`;

  if (!GlobalFonts.registerFromPath(FONT_FILE, "ProximaNovaBold")) {
    throw new Error(`Could not load font: ${FONT_FILE}`);
  }

  const art = await loadImage(ART_FILE);
  const width = art.width;
  const height = art.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(art, 0, 0, width, height);
  // Sample the row just above the band: it is never painted, so re-runs keep
  // picking the same colour from the untouched artwork.
  ctx.fillStyle = dominantColor(
    ctx.getImageData(0, ERASE_TOP - 1, width, 1).data,
  );
  ctx.fillRect(0, ERASE_TOP, width, ERASE_BOTTOM - ERASE_TOP + 1);

  ctx.font = `${FONT_SIZE}px ProximaNovaBold`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";

  const metrics = ctx.measureText(label);
  const ascent = metrics.actualBoundingBoxAscent ?? FONT_SIZE * 0.75;
  const descent = metrics.actualBoundingBoxDescent ?? FONT_SIZE * 0.25;
  const baseline = TEXT_CENTER_Y + (ascent - descent) / 2;

  ctx.fillText(label, width / 2, baseline);

  fs.writeFileSync(ART_FILE, canvas.toBuffer("image/png"));
  console.log(`splash -> ${path.relative(ROOT, ART_FILE)} (${label})`);
  fs.writeFileSync(WEBP_FILE, await canvas.encode("webp", WEBP_QUALITY));
  console.log(`splash -> ${path.relative(ROOT, WEBP_FILE)} (${label})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
