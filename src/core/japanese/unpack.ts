import { Gunzip } from "fflate";

/** Compressed bytes inflated per step: zero padding expands ~1000×, so steps stay small. */
const SLICE_BYTES = 4_096;
/** JS time spent inflating before yielding to the event loop (ms). */
const BUDGET_MS = 12;

/** Gives the event loop a turn (taps, timers, renders) between steps. */
export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Inflates a `.gz` in small time-boxed steps, yielding in between, so a
 * 40 MB file never blocks the JS thread for more than a frame or so. Returns
 * the content without its trailing zero padding; throws when the content
 * is not `unpacked` bytes long.
 */
export async function gunzipTrimmed(
  gz: Uint8Array,
  unpacked: number,
  onProgress: (compressedDone: number) => void = () => {},
  yieldNow: () => Promise<void> = yieldToEventLoop,
): Promise<Uint8Array> {
  const out = new Uint8Array(unpacked);
  let written = 0;
  const inflater = new Gunzip((chunk) => {
    if (written + chunk.length > unpacked) throw new Error("dictionary file larger than published");
    out.set(chunk, written);
    written += chunk.length;
  });

  let offset = 0;
  while (offset < gz.length) {
    const started = Date.now();
    while (offset < gz.length && Date.now() - started < BUDGET_MS) {
      const end = Math.min(offset + SLICE_BYTES, gz.length);
      inflater.push(gz.subarray(offset, end), end === gz.length);
      offset = end;
    }
    onProgress(offset);
    await yieldNow();
  }
  if (written !== unpacked) throw new Error("dictionary file shorter than published");

  let end = written;
  while (end > 0 && out[end - 1] === 0) end -= 1;
  return out.subarray(0, end);
}

/** The stored content padded back to its published size (kuromoji's view). */
export function padTo(stored: Uint8Array, unpacked: number): Uint8Array {
  if (stored.length === unpacked) return stored;
  const full = new Uint8Array(unpacked);
  full.set(stored);
  return full;
}
