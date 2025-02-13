export type MusicRequestDTO = {
  id: number;
  title: string;
  author: string;
  image_large?: string;
  image_medium?: string;
  image_tiny?: string;
  timestrike?: string;
};

export type MusicRequestResponseDTO = {
  meta: {
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total_count: number;
  };
  objects: MusicRequestDTO[];
};

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
  ios: number;
}
