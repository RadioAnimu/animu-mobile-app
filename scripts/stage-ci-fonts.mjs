import fs from "node:fs";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const names = ["proximanova-reg.ttf", "proximanova-bold.ttf"];
export function stageFonts(parts, directory) {
  if (parts.length !== 5 || parts.some(part => typeof part !== "string" || !part)) {
    throw new Error("Private build-font archive is unavailable");
  }
  const archive = parts.join("");
  if (archive.length > 256 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(archive)) {
    throw new Error("Invalid private build-font archive");
  }
  const data = JSON.parse(brotliDecompressSync(Buffer.from(archive, "base64"), { maxOutputLength: 2 * 1024 * 1024 }));
  if (!data || Object.keys(data).length !== names.length || names.some(name => typeof data[name] !== "string")) {
    throw new Error("Private archive must contain exactly the two build fonts");
  }
  const fonts = names.map(name => {
    const bytes = Buffer.from(data[name], "base64");
    if (bytes.length < 12 || bytes.length > 1024 * 1024 ||
      (!bytes.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0])) && bytes.subarray(0, 4).toString() !== "OTTO")) {
      throw new Error("Invalid build-font format");
    }
    return { name, bytes };
  });
  fs.mkdirSync(directory, { recursive: true });
  for (const { name, bytes } of fonts) {
    const fd = fs.openSync(path.join(directory, name), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, bytes); } finally { fs.closeSync(fd); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    stageFonts([1, 2, 3, 4, 5].map(i => process.env[`IOS_BUILD_FONT_ARCHIVE_${i}`]), "src/assets/fonts");
    console.log("Private build fonts staged");
  } catch {
    // Decompression/JSON errors can include input. Never report secret data.
    console.error("Private build fonts could not be staged; verify the five repository secrets.");
    process.exitCode = 1;
  }
}
