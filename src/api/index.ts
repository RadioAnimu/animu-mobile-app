const BASE_URL = "https://api.animu.com.br/";
const PROGRAM_URL = "https://www.animu.com.br/teste/locutor.php";
const PEDIDOS_URL = "https://www.animu.com.br/pedidos/";
const SAIJIKKOU_URL = "https://api.animu.com.br/?r=sj";

export const API = {
  BASE_URL,
  PROGRAM_URL,
  PEDIDOS_URL,
  SAIJIKKOU_URL,
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
  isSaijikkou: boolean;
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
