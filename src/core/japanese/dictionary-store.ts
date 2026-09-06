import { createStore } from "../player/store";

// ─── Offline Japanese dictionary state ───
//
// Two independent lifecycles shown in the UI:
// - `download`: the IPADIC files on disk (Settings section drives this);
// - `tokenizer`: the in-memory kuromoji build (lyrics view triggers it
//   lazily on first Japanese song — it's a heavy parse, ~seconds).

export type DownloadStatus = "none" | "downloading" | "ready" | "error";
export type TokenizerStatus = "idle" | "loading" | "ready" | "error";

export type JapaneseDictSnapshot = {
  download: DownloadStatus;
  /** 0..1 while downloading (per-file granularity). */
  progress: number;
  tokenizer: TokenizerStatus;
};

export const JAPANESE_DICT_INITIAL: JapaneseDictSnapshot = {
  download: "none",
  progress: 0,
  tokenizer: "idle",
};

export const japaneseDictStore =
  createStore<JapaneseDictSnapshot>(JAPANESE_DICT_INITIAL);
