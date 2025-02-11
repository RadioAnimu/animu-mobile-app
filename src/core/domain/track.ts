export type Track = {
  id: string;
  raw: string;
  title: string;
  artist: string;
  anime: string;
  artworks: {
    tiny?: string;
    medium?: string;
    large?: string;
  };
  artwork: string;
  duration: number;
  progress: number;
  isRequest: boolean;
  startTime: Date;
  metadata: {
    artist: string; // artist
    title: string; // anime
    artwork: string; // cover artwork
  };
};

export const updateTrackProgress = (track: Track): Track => {
  const progress = Date.now() - track.startTime.getTime();
  return { ...track, progress };
};
