import { Stream } from "../core/domain/stream";

const DEFAULT_COVER: string =
  "https://www.animu.com.br/wp-content/uploads/2022/11/Animu-icon-para-OC.png";

const STREAM_OPTIONS: Stream[] = [
  {
    id: "320",
    bitrate: 320,
    category: "MP3",
    url: "https://cast.animu.com.br:9079/stream",
  },
  {
    id: "192",
    bitrate: 192,
    category: "MP3",
    url: "https://cast.animu.com.br:9089/stream",
  },
  {
    id: "128",
    bitrate: 64,
    category: "AAC+",
    url: "https://cast.animu.com.br:9069/stream",
  },
  {
    id: "64",
    bitrate: 320,
    category: "REPRISES",
    url: "https://cast.animu.com.br:9019/stream",
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
