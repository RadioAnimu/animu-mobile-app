import { useState } from "react";
import { LiveRequest, validateLiveRequest } from "@/core/domain/live-request";

export function useLiveRequestForm(initialData?: Partial<LiveRequest>) {
  const [name, setName] = useState(initialData?.name || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [artist, setArtist] = useState(initialData?.artist || "");
  const [music, setMusic] = useState(initialData?.music || "");
  const [anime, setAnime] = useState(initialData?.anime || "");
  const [request, setRequest] = useState(initialData?.request || "");

  const setField = (field: keyof LiveRequest, text: string) => {
    const setter = {
      name: setName,
      city: setCity,
      artist: setArtist,
      music: setMusic,
      anime: setAnime,
      request: setRequest,
    }[field];
    setter(text);
  };

  const reset = () => {
    setName("");
    setCity("");
    setArtist("");
    setMusic("");
    setAnime("");
    setRequest("");
  };

  const getFormData = (): LiveRequest => ({
    name,
    city,
    artist,
    music,
    anime,
    request,
  });

  const isFormValid = (): boolean => {
    return isFormDataValid(getFormData());
  };

  return {
    formData: {
      name,
      city,
      artist,
      music,
      anime,
      request,
    },
    setters: {
      setName,
      setCity,
      setArtist,
      setMusic,
      setAnime,
      setRequest,
    },
    setField,
    isFormValid,
    isFormDataValid,
    reset,
    getFormData,
  };
}

export const isFormDataValid = (formData: LiveRequest): boolean =>
  validateLiveRequest(formData).success;

/** Required live-form fields, in on-screen order (first invalid gets focus). */
export const LIVE_REQUIRED_FIELDS = [
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
