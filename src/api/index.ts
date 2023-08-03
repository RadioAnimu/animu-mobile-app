const BASE_URL = "https://api.animu.com.br/";
const PROGRAM_URL = "https://www.animu.com.br/teste/locutor.php";
const PEDIDOS_URL = "https://www.animu.com.br/pedidos/";

export const API = {
  BASE_URL,
  PROGRAM_URL,
  PEDIDOS_URL,
};

export interface AnimuInfoProps {
  listeners: number;
  rawtitle: string;
  track: TrackProps;
  program: ProgramProps;
}

export interface ProgramProps {
  locutor: string;
  programa: string;
  isLiveProgram: boolean;
}

export interface TrackProps {
  rawtitle: string;
  anime: string;
  song: string;
  artist: string;
  artworks: {
    cover: string;
    tiny?: string;
    medium?: string;
    large?: string;
  };
  timestart: number;
  duration: number;
  isRequest: boolean;
  progress: number;
}
