import { Platform } from "react-native";
import { requestPermissionsAsync } from "expo-media-library";

/** Adding our own image through MediaStore needs no permission on Android 10+. */
export async function canSaveToPhotoLibrary(): Promise<boolean> {
  if (Platform.OS === "android" && Number(Platform.Version) >= 29) return true;
  return (await requestPermissionsAsync(true)).granted;
}
