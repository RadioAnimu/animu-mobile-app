import { z } from "zod";

/**
 * Schema-first DTO: the API has shipped numeric fields as strings
 * (e.g. timestart: "1788408452000"), so numeric fields are coerced here.
 * Types are derived from the schema — runtime reality and compile-time
 * types can no longer diverge.
 */
export const TrackDTOSchema = z.object({
  rawtitle: z.string().optional(),
  track: z.object({
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
  }),
});

export type TrackDTO = z.infer<typeof TrackDTOSchema>;
