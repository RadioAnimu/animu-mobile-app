import { Program } from "../utils/player.config";

const WEB_URL = "https://www.animu.com.br/";
const BASE_URL = "https://api.animu.com.br/";
const PROGRAM_URL = "https://www.animu.com.br/teste/locutor.php";
const PEDIDOS_URL = "https://www.animu.com.br/pedidos/";
const SAIJIKKOU_URL = "https://api.animu.com.br/?r=sj";
const ULTIMAS_PEDIDAS_URL =
  "https://www.animu.com.br/teste/ultimospedidos_json.php";
const ULTIMAS_TOCADAS_URL =
  "https://www.animu.com.br/teste/ultimasmusicas_json.php";
const FAZER_PEDIDO_URL =
  "https://www.animu.com.br/teste/requestSearchTest.php?server=1&filter=&limit=25&offset=0&requestable=true&query=";
const DISCORD_URL = "https://discord.animu.com.br";

export const API = {
  WEB_URL,
  BASE_URL,
  PROGRAM_URL,
  PEDIDOS_URL,
  SAIJIKKOU_URL,
  ULTIMAS_PEDIDAS_URL,
  ULTIMAS_TOCADAS_URL,
  FAZER_PEDIDO_URL,
  DISCORD_URL,
};

export interface AnimuInfoProps {
  listeners: number;
  rawtitle: string;
  track: TrackProps;
  program: ProgramProps;
  ultimasPedidas: TrackProps[];
  ultimasTocadas: TrackProps[];
}

export interface MusicRequestProps {
  track: TrackProps;
  requestable: boolean;
}

export interface ProgramProps {
  locutor: string;
  programa: string;
  isLiveProgram: boolean;
  pedidos_ao_vivo: string;
  isSaijikkou: boolean;
  infoPrograma: string;
  imagem: string;
  raw: Program | undefined;
  temaPrograma: string;
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
  id: number;
}
