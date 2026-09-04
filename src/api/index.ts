/**
 * App-owned URLs and UI-facing types.
 *
 * The Animu API itself lives in the `animu-api` package (see ./client.ts) —
 * only URLs the UI links to directly remain here.
 */

const WEB_URL = "https://www.animu.com.br/";
const PEDIDOS_URL = "https://www.animu.com.br/pedidos/";
const DISCORD_URL = "https://discord.animu.com.br";

export const API = {
  WEB_URL,
  PEDIDOS_URL,
  DISCORD_URL,
};

/** Program dictionary entry used by the i18n PROGRAMS tables. */
export interface Program {
  img: string;
  name: string;
  dj: string;
  theme: string;
  dayAndTime: string;
  information: string;
}
