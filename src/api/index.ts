const WEB_URL = "https://www.animu.com.br/";
const BASE_URL = "https://api.animu.com.br/";
const PROGRAM_URL = "https://www.animu.com.br/teste/locutor.php";
const PEDIDOS_URL = "https://www.animu.com.br/pedidos/";
const SAIJIKKOU_URL = "https://api.animu.com.br/?r=sj";
const ULTIMAS_PEDIDAS_URL =
  "https://www.animu.com.br/teste/ultimospedidos_json.php";
const ULTIMAS_TOCADAS_URL =
  "https://www.animu.com.br/teste/ultimasmusicas_json.php";
const FAZER_PEDIDO_URL = "https://www.animu.com.br/teste/requestSearchTest.php";
const FAZER_PEDIDO_URL_MOBILE_SUBMIT =
  "https://www.animu.com.br/teste/pedirquatroMobile.php";
const DISCORD_URL = "https://discord.animu.com.br";
const LIVE_REQUEST_URL =
  "https://www.animu.com.br/paineldj/ajaxforms(defasado)/request/salvar.php";

export interface Program {
  img: string;
  name: string;
  dj: string;
  theme: string;
  dayAndTime: string;
  information: string;
}

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
  LIVE_REQUEST_URL,
  FAZER_PEDIDO_URL_MOBILE_SUBMIT,
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
  pedidos_ao_vivo: string;
  imagem: string;
  infoPrograma: string;
  temaPrograma: string;

  raw: Program | undefined;
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
  id: number;
}
