import type { Dict } from "@/i18n";

/** Role labels resolve through the dict so they translate. */
export type RoleKey =
  | "ABOUT_ROLE_FOUNDER"
  | "ABOUT_ROLE_DEVELOPER"
  | "ABOUT_ROLE_MAINTAINER"
  | "ABOUT_ROLE_ARTWORK";

export interface TeamMember {
  name: string;
  alias?: string;
  role: RoleKey;
  /** Optional profile link for the member's name. */
  url?: string;
}

/** The station team, mirroring the animu.moe credits. */
export const TEAM: TeamMember[] = [
  { name: "Lucas Lopes", alias: "LL!", role: "ABOUT_ROLE_FOUNDER" },
  { name: "Afonso Oliveira", alias: "FZero", role: "ABOUT_ROLE_DEVELOPER" },
  { name: "José Silva", alias: "Tossa", role: "ABOUT_ROLE_DEVELOPER" },
  { name: "João Vitor", alias: "Mr.Zapp", role: "ABOUT_ROLE_DEVELOPER" },
  {
    name: "Ricardo Freitas",
    alias: "Ness",
    role: "ABOUT_ROLE_MAINTAINER",
    url: "https://rmotafreitas.dev",
  },
  {
    name: "NPCpepper",
    role: "ABOUT_ROLE_ARTWORK",
    url: "https://www.pixiv.net/en/users/3272093",
  },
];

export interface Donor {
  name: string;
  /** Optional role/alias shown after the name. */
  note?: string;
}

/**
 * The people who funded the app's original Android (and later iOS) launch
 * with donations between 15 and 18 February 2024. Names kept as given.
 */
export const DONORS: Donor[] = [
  { name: "kohiwainochi ☕" },
  { name: "luigiish", note: "Tagger de Love Live!" },
  { name: "KiritoJPK", note: "Tagger & Uploader" },
  { name: "j4p0n「ジャポン」" },
  { name: "um_pato_qualquer", note: "Jean" },
  { name: "Julio Sawada" },
  { name: "senhorzinho", note: "Senhorzinho" },
  { name: "Hud C.A", note: "Tagger Animu" },
  { name: "Rin", note: "Tags bandori, im@s, pjsk" },
  { name: "Elis" },
  { name: "Dolode" },
  { name: "Will Fall", note: "Tags de Touhou/D4DJ" },
  { name: "ChiiChan", note: "Leandro" },
  { name: "ER1C52x ☕", note: "Cafeicultor Animu" },
  { name: "Vitor" },
  { name: "vigne", note: "Vigne" },
  { name: "Bene" },
];

/** Role label from the dict, or the raw key if it is somehow missing. */
export const roleLabel = (dict: Dict, role: RoleKey): string => dict[role];
