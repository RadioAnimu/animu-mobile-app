import { z } from "zod";

/**
 * Now-playing payload from the API base URL.
 *
 * The API has shipped numeric fields as strings, so numbers are coerced.
 * `track` is optional: payloads without track data degrade to a null track.
 */
export const TrackDTOSchema = z.object({
  rawtitle: z.string().optional(),
  track: z
    .object({
      artist: z.string().optional(),
      title: z.string().optional(),
      duration: z.coerce.number(),
      timestart: z.coerce.number(),
      artworks: z
        .object({
          tiny: z.string().optional(),
          medium: z.string().optional(),
          large: z.string().optional(),
        })
        .optional(),
      playlist: z
        .object({
          track_id: z.coerce.number(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Listener count fields. The field name varies between endpoints/versions —
 * all known aliases are accepted and coerced (the API has sent strings).
 */
export const ListenersDTOSchema = z.object({
  listeners: z.coerce.number().optional(),
  currentListeners: z.coerce.number().optional(),
  active_listeners: z.coerce.number().optional(),
  total: z.coerce.number().optional(),
});

/** Combined schema for the BASE_URL payload (track info + listener count). */
export const StreamMetadataDTOSchema = z.object({
  ...TrackDTOSchema.shape,
  ...ListenersDTOSchema.shape,
});

/** PHP page endpoint — every field degrades to "" instead of failing. */
export const ProgramDTOSchema = z.object({
  locutor: z.string().catch(""),
  programa: z.string().catch(""),
  pedidos_ao_vivo: z.string().catch(""),
  imagem: z.string().catch(""),
  infoPrograma: z.string().catch(""),
  temaPrograma: z.string().catch(""),
});

/**
 * History endpoints return positional PHP arrays:
 *   played:   [title, coverUrl]
 *   requests: [title, HH:MM:SS, requestId?, coverUrl?]
 * Trailing entries are a loose union. A row that isn't an array with at
 * least two string entries fails the whole payload (consumers degrade to []).
 */
export const TrackHistoryItemSchema = z.tuple(
  [z.string(), z.string()],
  z.union([z.string(), z.number()]),
);

/** Array of history rows; validated with {@link TrackHistoryItemSchema}. */
export const TrackHistorySchema = z.array(TrackHistoryItemSchema);

/** One row of the request-search database. `timestrike` marks blocked tracks. */
export const MusicRequestDTOSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  author: z.string().catch(""),
  image_large: z.string().optional(),
  image_medium: z.string().optional(),
  image_tiny: z.string().optional(),
  timestrike: z.string().optional(),
});

/** Paginated request-search response (Tastypie-style envelope). */
export const MusicRequestResponseDTOSchema = z.object({
  meta: z.object({
    limit: z.coerce.number(),
    next: z.string().nullable(),
    offset: z.coerce.number(),
    previous: z.string().nullable(),
    total_count: z.coerce.number(),
  }),
  objects: z.array(MusicRequestDTOSchema),
});

/** One audio stream from the stream list endpoint. */
export const StreamDTOSchema = z.object({
  id: z.string(),
  bitrate: z.coerce.number(),
  category: z.string(),
  url: z.string(),
});

/** Stream list — must contain at least one relay to be trusted. */
export const StreamListDTOSchema = z.array(StreamDTOSchema).nonempty();

/** Discord user payload returned by the token-exchange endpoint. */
export const UserDTOSchema = z.object({
  id: z.string(),
  username: z.string(),
  nickname: z.string(),
  avatar: z.string(),
  avatar_url: z.string(),
  PHPSESSID: z.string(),
  mfa: z.coerce.boolean(),
  avatar_decoration_data: z.unknown().optional(),
});

export type TrackDTO = z.infer<typeof TrackDTOSchema>;
export type ListenersDTO = z.infer<typeof ListenersDTOSchema>;
export type StreamMetadataDTO = z.infer<typeof StreamMetadataDTOSchema>;
export type ProgramDTO = z.infer<typeof ProgramDTOSchema>;
export type TrackHistoryItemDTO = z.infer<typeof TrackHistoryItemSchema>;
export type TrackHistoryDTO = z.infer<typeof TrackHistorySchema>;
export type MusicRequestDTO = z.infer<typeof MusicRequestDTOSchema>;
export type MusicRequestResponseDTO = z.infer<
  typeof MusicRequestResponseDTOSchema
>;
export type StreamDTO = z.infer<typeof StreamDTOSchema>;
export type UserDTO = z.infer<typeof UserDTOSchema>;
