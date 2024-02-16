const DEFAULT_COVER =
  "https://cdn.discordapp.com/attachments/634406949198364702/1093233650025377892/Animu-3-anos-nova-logo.png";

const BITRATES = {
  320: {
    category: "MP3",
    url: "https://cast.animu.com.br:9079/stream",
  },
  192: {
    category: "MP3",
    url: "https://cast.animu.com.br:9089/stream",
  },
  64: {
    category: "AAC+",
    url: "https://cast.animu.com.br:9069/stream",
  },
};

const DEFAULT_BITRATE: keyof typeof BITRATES = 320;

const USER_AGENT = "Animu Mobile App";

export const CONFIG = {
  BITRATES,
  DEFAULT_BITRATE,
  DEFAULT_COVER,
  USER_AGENT,
};
