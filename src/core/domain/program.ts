export type Program = {
  name: string;
  dj: string;
  isLive: boolean;
  isSaijikkou: boolean;
  imageUrl: string;
  info: string;
  theme: string;
  acceptingRequests: boolean;
  raw?: {
    name: string;
    dj: string;
    theme: string;
    dayAndTime: string;
    information: string;
  };
};
