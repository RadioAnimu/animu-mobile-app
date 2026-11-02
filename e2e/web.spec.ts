import { expect, test, type Page } from "@playwright/test";

/** Rows of the oscilloscope's canvas with anything drawn: a waveform spans many, the idle line a few. */
async function scopeRows(page: Page): Promise<number> {
  const frame = page.frameLocator('iframe[title="oscilloscope"]');
  return frame.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let rows = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3]! > 0) {
          rows++;
          break;
        }
      }
    }
    return rows;
  });
}

test.beforeEach(async ({ page }) => {
  // Whatever is on air has lyrics: LRCLIB answers with the song it was asked for.
  await page.route("https://lrclib.net/api/**", (route) => {
    const query = new URL(route.request().url()).searchParams;
    const row = {
      id: 1,
      trackName: query.get("track_name") ?? query.get("q") ?? "",
      artistName: query.get("artist_name") ?? "",
      albumName: "",
      duration: Number(query.get("duration") ?? 240),
      instrumental: false,
      plainLyrics: "la la la",
      syncedLyrics: "[00:00.00] la la la",
    };
    return route.fulfill({ json: route.request().url().includes("/search") ? [row] : row });
  });
  await page.goto("/");
  await expect(page.getByLabel("Reproduzir").first()).toBeVisible({ timeout: 20_000 });
});

test("plays the stream through fetch, without headers the server would have to allow", async ({ page }) => {
  const fetched: number[] = [];
  page.on("response", (response) => {
    const request = response.request();
    if (/stream\.animu\.moe\/\d+/.test(request.url()) && request.resourceType() === "fetch") {
      fetched.push(response.status());
    }
  });
  await page.getByLabel("Reproduzir").first().click();
  // A custom User-Agent makes Safari and Firefox preflight the stream, which
  // the server refuses: the fetch fails and playback falls back to a plain
  // <audio>, whose request would not count here.
  await expect.poll(() => fetched, { timeout: 15_000 }).toContain(200);
});

test("draws the oscilloscope from the playing audio", async ({ page }) => {
  await page.getByLabel("Reproduzir").first().click();
  await expect.poll(() => scopeRows(page), { timeout: 20_000, intervals: [1000] }).toBeGreaterThan(8);
});

test("blurs the lyrics backdrop once, not with CSS filters redrawn every frame", async ({ page }) => {
  await page.getByLabel("Mostrar letra").first().click();
  await expect(page.locator("canvas").first()).toBeAttached();
  const blurred = await page.evaluate(() =>
    [...document.querySelectorAll("*")].filter((element) => /blur\([1-9]/.test(getComputedStyle(element).filter)).length,
  );
  expect(blurred).toBe(0);
});
