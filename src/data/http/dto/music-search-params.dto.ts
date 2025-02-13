export type MusicSearchParamsDto = {
  server: number;
  filter?: string;
  query: string;
  requestable?: boolean;
  limit?: number;
  offset?: number;
};
