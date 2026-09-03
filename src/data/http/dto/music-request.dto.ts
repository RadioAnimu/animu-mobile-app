import { z } from "zod";

export const MusicRequestDTOSchema = z.object({
  id: z.coerce.number(),
  title: z.string(),
  author: z.string().catch(""),
  image_large: z.string().optional(),
  image_medium: z.string().optional(),
  image_tiny: z.string().optional(),
  timestrike: z.string().optional(),
});

export type MusicRequestDTO = z.infer<typeof MusicRequestDTOSchema>;

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

export type MusicRequestResponseDTO = z.infer<
  typeof MusicRequestResponseDTOSchema
>;

// ─── Outbound params (constructed by the app, not parsed from API) ───

export type MusicSearchParamsDto = {
  server: number;
  filter?: string;
  query: string;
  requestable?: boolean;
  limit?: number;
  offset?: number;
};

export interface MusicRequestSubmissionDTO {
  allmusic: string;
  message: string;
  PHPSESSID: string;
}
