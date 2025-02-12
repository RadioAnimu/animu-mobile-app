import { Track } from "./track";

export interface MusicRequest {
  track: Track;
  requestable: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    totalCount: number;
    totalPages: number;
  };
}
