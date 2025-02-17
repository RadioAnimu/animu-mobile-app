import { z } from "zod";

export const LiveRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  city: z
    .string()
    .min(1, "Cidade é obrigatória")
    .max(100, "Cidade deve ter no máximo 100 caracteres"),
  artist: z
    .string()
    .min(1, "Artista é obrigatório")
    .max(100, "Artista deve ter no máximo 100 caracteres"),
  music: z
    .string()
    .min(1, "Música é obrigatória")
    .max(100, "Música deve ter no máximo 100 caracteres"),
  anime: z
    .string()
    .min(1, "Anime é obrigatório")
    .max(100, "Anime deve ter no máximo 100 caracteres"),
  request: z
    .string()
    .max(500, "Recado deve ter no máximo 500 caracteres")
    .optional()
    .default(""),
});

export type LiveRequest = z.infer<typeof LiveRequestSchema>;
