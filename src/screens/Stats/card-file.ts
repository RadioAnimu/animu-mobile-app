import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { canSaveToPhotoLibrary } from "@/utils/mediaLibrary";

/** What view-shot writes the card to: a temp PNG the share sheet / gallery read. */
export const CARD_RESULT = "tmpfile" as const;

/**
 * A direct save next to sharing: iOS's share sheet already offers "Save
 * Image", Android's can't guarantee a save.
 */
export const CARD_SAVE_ACTION = Platform.OS === "android";

/** Hands the PNG to the system share sheet; `false` when there is none. */
export async function shareCard(uri: string, title: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title });
  return true;
}

/** Saves the PNG to the photo library; `false` without permission. */
export async function saveCard(uri: string): Promise<boolean> {
  if (!(await canSaveToPhotoLibrary())) return false;
  await MediaLibrary.Asset.create(uri);
  return true;
}

/** Best-effort delete of the raster's temp file once consumers are done. */
export function discardCard(uri: string): void {
  try {
    new File(uri.startsWith("file://") ? uri : `file://${uri}`).delete();
  } catch {
    // The OS clears tmp anyway — a failed unlink must not fail the action.
  }
}
