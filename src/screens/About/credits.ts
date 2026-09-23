/** Donor entries shown in the About screen's fold-out thank-you list. */
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
