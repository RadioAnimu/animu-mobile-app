import { useState } from "react";
import type { LiveRequest } from "@/core/domain/live-request";

/** Every field as text, the optional message included. */
type LiveRequestForm = Required<LiveRequest>;

const EMPTY: LiveRequestForm = { name: "", city: "", artist: "", music: "", anime: "", request: "" };

export function useLiveRequestForm(initialData?: Partial<LiveRequest>) {
  const [formData, setFormData] = useState<LiveRequestForm>(() => ({ ...EMPTY, ...initialData }));

  const setField = (field: keyof LiveRequest, text: string) =>
    setFormData((data) => ({ ...data, [field]: text }));

  const reset = () => setFormData(EMPTY);

  return { formData, setField, reset };
}

/** Required live-form fields, in on-screen order (first invalid gets focus). */
const LIVE_REQUIRED_FIELDS = [
  "name",
  "city",
  "music",
  "artist",
  "anime",
] as const satisfies readonly (keyof LiveRequest)[];

/** Length limits enforced by `validateLiveRequest` — inputs cap at these. */
export const LIVE_FIELD_MAX = 100;
export const LIVE_MESSAGE_MAX = 500;

/** Required fields that are blank (whitespace counts as blank). */
export const getMissingLiveFields = (
  formData: LiveRequest,
): (typeof LIVE_REQUIRED_FIELDS)[number][] =>
  LIVE_REQUIRED_FIELDS.filter((field) => formData[field].trim().length === 0);

/** Outgoing copy of the form: every value trimmed. */
export const trimLiveRequest = (data: LiveRequest): LiveRequest => ({
  name: data.name.trim(),
  city: data.city.trim(),
  artist: data.artist.trim(),
  music: data.music.trim(),
  anime: data.anime.trim(),
  request: (data.request ?? "").trim(),
});
