/**
 * App-owned URLs and UI-facing types.
 *
 * The Animu API itself lives in the `animu-api` package (see ./client.ts) —
 * only URLs the UI links to directly remain here.
 */

const WEB_URL = "https://www.animu.com.br/";
const REQUESTS_URL = "https://www.animu.com.br/pedidos/";
const DISCORD_URL = "https://discord.animu.com.br";
/** Same policy URL declared on the Google Play production listing. */
const PRIVACY_URL = "https://www.animu.com.br/privacypolicy";
/** Project license shown in the animu.moe footer. */
const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
/** Social profiles mirrored from the animu.moe footer. */
const FACEBOOK_URL = "https://www.facebook.com/radioanimu";
const X_URL = "https://x.com/RadioAnimu";
const BLUESKY_URL = "https://bsky.app/profile/animu.moe";
/** Open-source repository for this app. */
const GITHUB_URL = "https://github.com/RadioAnimu/animu-mobile-app";
/** Composer of the Chihaya Radio Station artwork (credited, not a station social). */
const PIXIV_URL = "https://www.pixiv.net/en/users/3272093";

export const API = {
  WEB_URL,
  REQUESTS_URL,
  DISCORD_URL,
  PRIVACY_URL,
  LICENSE_URL,
  FACEBOOK_URL,
  X_URL,
  BLUESKY_URL,
  GITHUB_URL,
  PIXIV_URL,
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
