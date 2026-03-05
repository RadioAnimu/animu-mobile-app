import { useState } from "react";
import { LiveRequest, validateLiveRequest } from "../core/domain/live-request";
import { HttpRequestError } from "../core/errors/http.error";

export function useLiveRequestForm(initialData?: Partial<LiveRequest>) {
  const [name, setName] = useState(initialData?.name || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [artist, setArtist] = useState(initialData?.artist || "");
  const [music, setMusic] = useState(initialData?.music || "");
  const [anime, setAnime] = useState(initialData?.anime || "");
  const [request, setRequest] = useState(initialData?.request || "");

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
    isFormValid,
    isFormDataValid,
    reset,
    getFormData,
  };
}

export const isFormDataValid = (formData: LiveRequest): boolean => {
  const result = validateLiveRequest(formData);
  if (!result.success) {
    throw new HttpRequestError(`Invalid field: ${result.message}`, 400);
  }
  return true;
};
