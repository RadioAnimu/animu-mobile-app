import { z } from "zod";

export const StreamDTOSchema = z.object({
  id: z.string(),
  bitrate: z.coerce.number(),
  category: z.string(),
  url: z.string(),
});

export const StreamListDTOSchema = z.array(StreamDTOSchema).nonempty();

export type StreamDTO = z.infer<typeof StreamDTOSchema>;
