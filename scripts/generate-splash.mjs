#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const ART_FILE = path.join(ROOT, "assets/splash_top.png");
const FONT_FILE = path.join(ROOT, "src/assets/fonts/proximanova-bold.ttf");

const FONT_SIZE = Number(process.env.SPLASH_FONT_SIZE ?? 60);
const ERASE_TOP = 560;
const ERASE_BOTTOM = 658;
const TEXT_CENTER_Y = 595;

async function main() {
  const app = readJson(path.join(ROOT, "app.json")).expo;
  const pkg = readJson(path.join(ROOT, "package.json"));
  const version = app.version ?? pkg.version;
  // The legacy top-level `splash` key was replaced by the `expo-splash-screen`
  // config plugin in SDK 55+; read the background from there.
  const splashPlugin = (app.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  );
  const background = splashPlugin?.[1]?.backgroundColor ?? "#270052";
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
  ctx.fillStyle = background;
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
