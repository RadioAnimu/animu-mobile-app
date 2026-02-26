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
  isRequest: boolean;
  startTime: Date;
  metadata: {
    artist: string; // artist
    title: string; // anime
    artwork: string; // cover artwork
    duration: number; // duration in milliseconds
  };
};

export const getTrackProgress = (track?: Track): number | null => {
  if (!track) return null;

  // Ensure that startTime is not in the future.
  const now = Date.now();
  const start = track.startTime.getTime();
  if (start > now) return null;

  // Calculate elapsed time in milliseconds.
  const elapsed = now - start;

  // Validate that the track duration is positive.
  if (track.duration <= 0) return null;

  // If the elapsed time is greater than the track's duration, return null.
  // This also avoids cases where an ended track might incorrectly report progress.
  if (elapsed > track.duration) return null;

  return elapsed;
};
