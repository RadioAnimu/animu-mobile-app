import { z } from "zod";
import { TrackDTOSchema } from "./track.dto";
import { ListenersDTOSchema } from "./listeners.dto";

/**
 * Combined DTO for the single BASE_URL endpoint that returns
 * both track info and listener count in one response.
 */
export const StreamMetadataDTOSchema = z.object({
  ...TrackDTOSchema.shape,
  ...ListenersDTOSchema.shape,
});

export type StreamMetadataDTO = z.infer<typeof StreamMetadataDTOSchema>;
