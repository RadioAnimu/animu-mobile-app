#!/usr/bin/env node
/**
 * Ensures the licensed Proxima Nova fonts are present for a build.
 *
 * The font files are commercial (Copyright (c) Mark Simonson, all rights
 * reserved) and are intentionally NOT committed to this public repository.
 *
 * Locally, place the two .ttf files in src/assets/fonts/ (see the README
 * there). For EAS cloud builds, point PROXIMA_NOVA_FONTS_URL at a zip that
 * contains them, or PROXIMA_NOVA_FONTS_DIR at a directory holding them.
 *
 * Wired to the `eas-build-pre-install` hook in package.json.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = path.join(ROOT, "src/assets/fonts");
const FONTS = ["proximanova-reg.ttf", "proximanova-bold.ttf"];

const missingFonts = () =>
  FONTS.filter((file) => !fs.existsSync(path.join(FONT_DIR, file)));

const fail = (message) => {
  console.error(`[fonts] ${message}`);
  process.exit(1);
};

/** Recursively finds a file by name under `dir`. */
function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

function copyFromDir(sourceDir, files) {
  for (const file of files) {
    const source = path.join(sourceDir, file);
    if (!fs.existsSync(source)) fail(`${source} not found`);
    fs.copyFileSync(source, path.join(FONT_DIR, file));
  }
}

function fetchFromUrl(url) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "animu-fonts-"));
  const archive = path.join(tmp, "fonts.zip");
  const extracted = path.join(tmp, "extracted");
  try {
    fs.mkdirSync(extracted);
    execFileSync("curl", ["-fsSL", url, "-o", archive], { stdio: "inherit" });
    execFileSync("unzip", ["-o", archive, "-d", extracted], { stdio: "inherit" });
    for (const file of FONTS) {
      const source = findFile(extracted, file);
      if (!source) fail(`archive does not contain ${file}`);
      fs.copyFileSync(source, path.join(FONT_DIR, file));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const absent = missingFonts();
  if (absent.length === 0) {
    console.log("[fonts] licensed fonts already present");
    return;
  }

  if (process.env.PROXIMA_NOVA_FONTS_DIR) {
    copyFromDir(process.env.PROXIMA_NOVA_FONTS_DIR, absent);
    console.log("[fonts] copied fonts from PROXIMA_NOVA_FONTS_DIR");
  } else if (process.env.PROXIMA_NOVA_FONTS_URL) {
    fetchFromUrl(process.env.PROXIMA_NOVA_FONTS_URL);
    console.log("[fonts] fetched fonts from PROXIMA_NOVA_FONTS_URL");
  } else {
    const hint =
      `missing ${absent.join(", ")}. Place the licensed files in ` +
      "src/assets/fonts/, or set PROXIMA_NOVA_FONTS_URL / " +
      "PROXIMA_NOVA_FONTS_DIR for the build. See src/assets/fonts/README.md.";
    // Local installs can proceed without the font; an EAS build cannot.
    if (process.env.EAS_BUILD) fail(hint);
    console.warn(`[fonts] ${hint}`);
    return;
  }

  const stillMissing = missingFonts();
  if (stillMissing.length) fail(`still missing after fetch: ${stillMissing.join(", ")}`);
}

main();
