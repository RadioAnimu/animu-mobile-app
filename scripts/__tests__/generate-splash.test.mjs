import { test } from "node:test";
import assert from "node:assert/strict";
import { dominantColor } from "../generate-splash.mjs";

// RGBA pixels, as canvas getImageData returns them; alpha defaults to opaque.
const row = (...colors) =>
  new Uint8ClampedArray(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));

test("dominantColor picks the most common colour in the row", () => {
  const pixels = row([12, 34, 56], [39, 0, 81], [39, 0, 80], [39, 0, 81]);
  assert.equal(dominantColor(pixels), "#270051");
});

test("dominantColor zero-pads each hex channel", () => {
  assert.equal(dominantColor(row([0, 0, 5])), "#000005");
  assert.equal(dominantColor(row([39, 0, 81])), "#270051");
});

test("dominantColor ignores alpha", () => {
  const pixels = row([1, 2, 3, 255], [39, 0, 81, 0], [39, 0, 81, 128]);
  assert.equal(dominantColor(pixels), "#270051");
});
