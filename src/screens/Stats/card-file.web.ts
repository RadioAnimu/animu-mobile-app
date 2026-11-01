/** Web build: view-shot rasterizes the card (html2canvas-pro) into a data URI. */
export const CARD_RESULT = "data-uri" as const;

/** Browsers get a download button: not every one can share files. */
export const CARD_SAVE_ACTION = true;

const FILE_NAME = "animu-card.png";

async function pngFile(uri: string): Promise<File> {
  const blob = await (await fetch(uri)).blob();
  return new File([blob], FILE_NAME, { type: "image/png" });
}

/** Shares the PNG through the Web Share API, or downloads it where the browser can't share files. */
export async function shareCard(uri: string, title: string): Promise<boolean> {
  const file = await pngFile(uri);
  if (!navigator.canShare?.({ files: [file] })) return saveCard(uri);
  try {
    await navigator.share({ files: [file], title });
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    // Closing the share sheet is not a failure.
    if (error.name === "AbortError") return true;
    // Safari only shares right after the tap; the capture took too long.
    if (error.name === "NotAllowedError") return saveCard(uri);
    throw error;
  }
  return true;
}

/** Downloads the PNG. */
export async function saveCard(uri: string): Promise<boolean> {
  const link = document.createElement("a");
  link.href = uri;
  link.download = FILE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

/** Nothing to clean up: the data URI lives in memory. */
export function discardCard(_uri: string): void {}
