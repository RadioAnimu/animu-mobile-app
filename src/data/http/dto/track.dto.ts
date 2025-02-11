export type TrackDTO = {
  rawtitle: string;
  track: {
    artist: string;
    duration: number;
    timestart: number;
    artworks: {
      tiny?: string;
      medium?: string;
      large?: string;
    };
    playlist: {
      track_id: number;
    };
  };
};
