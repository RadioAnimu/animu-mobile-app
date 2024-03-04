const DEFAULT_COVER: string =
  "https://cdn.discordapp.com/attachments/634406949198364702/1208229038192066640/Animu_icon_2023.png?ex=65e285fa&is=65d010fa&hm=f1136f9df203303a7e45da10e1474aba1ce60e170e8278d9ac472ac57848dd58&";

export interface StreamOption {
  bitrate: number;
  category: string;
  url: string;
}

const STREAM_OPTIONS: StreamOption[] = [
  {
    bitrate: 320,
    category: "MP3",
    url: "https://cast.animu.com.br:9079/stream",
  },
  {
    bitrate: 192,
    category: "MP3",
    url: "https://cast.animu.com.br:9089/stream",
  },
  {
    bitrate: 64,
    category: "AAC+",
    url: "https://cast.animu.com.br:9069/stream",
  },
  {
    bitrate: 320,
    category: "REPRISES",
    url: "https://cast.animu.com.br:9019/stream",
  },
];

const DEFAULT_STREAM_OPTION: StreamOption = STREAM_OPTIONS[0]; // 320bitrate MP3

const USER_AGENT: string = "Animu Mobile App";

export const CONFIG = {
  STREAM_OPTIONS,
  DEFAULT_STREAM_OPTION,
  DEFAULT_COVER,
  USER_AGENT,
};
