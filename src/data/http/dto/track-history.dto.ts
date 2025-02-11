export type TrackHistoryItemDTO = [
  title: string, // item[0]
  timeOrCover: string, // item[1] - time for requests, cover for played
  requestId?: number, // item[2] - only for requests
  coverUrl?: string // item[3] - only for requests
];

export type TrackHistoryDTO = TrackHistoryItemDTO[];
