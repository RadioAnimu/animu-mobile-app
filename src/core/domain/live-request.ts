export type LiveRequest = {
  name: string;
  city: string;
  artist: string;
  music: string;
  anime: string;
  request?: string;
};

export function validateLiveRequest(
  data: LiveRequest,
): { success: true } | { success: false; message: string } {
  const required: { key: keyof LiveRequest; label: string }[] = [
    { key: "name", label: "Nome é obrigatório" },
    { key: "city", label: "Cidade é obrigatória" },
    { key: "artist", label: "Artista é obrigatório" },
    { key: "music", label: "Música é obrigatória" },
    { key: "anime", label: "Anime é obrigatório" },
  ];

  for (const { key, label } of required) {
    const val = data[key];
    if (!val || val.trim().length === 0)
      return { success: false, message: label };
    if (val.length > 100)
      return {
        success: false,
        message: `${label.split(" ")[0]} deve ter no máximo 100 caracteres`,
      };
  }

  if (data.request && data.request.length > 500) {
    return {
      success: false,
      message: "Recado deve ter no máximo 500 caracteres",
    };
  }

  return { success: true };
}
