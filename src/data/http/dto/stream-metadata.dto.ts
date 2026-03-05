import { TrackDTO } from "./track.dto";
import { ListenersDTO } from "./listeners.dto";

/**
 * Combined DTO for the single BASE_URL endpoint that returns
 * both track info and listener count in one response.
 */
export type StreamMetadataDTO = TrackDTO & ListenersDTO;
