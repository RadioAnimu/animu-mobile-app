import { MusicSearchParamsDto } from "../../data/http/dto/music-search-params.dto";

export type MusicRequest = {
  id: string;
  raw: string;
  song: string;
  anime: string;
  artist: string;
  artwork: string;
  requestable: boolean;
};

export type MusicRequestPagination = {
  results: MusicRequest[];
  nextPageQueryObject?: MusicSearchParamsDto;
  totalResults: number;
  totalPages: number;
};
