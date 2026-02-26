import { Stream } from "../core/domain/stream";

const DEFAULT_COVER: string =
  "https://www.animu.com.br/wp-content/uploads/2022/11/Animu-icon-para-OC.png";

const STREAM_OPTIONS: Stream[] = [
  {
    id: "320",
    bitrate: 320,
    category: "MP3",
    url: "https://animu.moe/stream",
  },
  {
    id: "192",
    bitrate: 192,
    category: "MP3",
    url: "https://animu.moe/stream192",
  },
  {
    id: "64",
    bitrate: 64,
    category: "AAC+",
    url: "https://animu.moe/stream64",
  },
];

const DEFAULT_STREAM_OPTION: Stream = STREAM_OPTIONS[0]; // 320bitrate MP3

const USER_AGENT: string = "Animu Mobile App";

export const CONFIG = {
  STREAM_OPTIONS,
  DEFAULT_STREAM_OPTION,
  DEFAULT_COVER,
  USER_AGENT,
};
