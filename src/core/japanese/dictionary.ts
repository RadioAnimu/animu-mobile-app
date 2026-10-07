// ─── IPADIC for kuromoji 0.1.2 ───
//
// The 12 gzipped files the npm package ships under `dict/` (17.8 MB). They
// are downloaded on demand, never bundled, and each one is checked against
// the size and MD5 of the published package before it is used.

export const DICTIONARY_VERSION = "kuromoji-0.1.2-ipadic";

/** Mirrors of the npm package, tried in order for every file. */
export const DICTIONARY_MIRRORS = [
  "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/",
  "https://unpkg.com/kuromoji@0.1.2/dict/",
] as const;

export const DICTIONARY_FILES = {
  "base.dat.gz": { bytes: 3_956_825, md5: "7c8bbced46e88cdb77c9c66c9ca9fbcb" },
  "check.dat.gz": { bytes: 3_111_633, md5: "dcbeea0429520f5e669a75ff504241a7" },
  "tid.dat.gz": { bytes: 1_605_820, md5: "48d8e87b50f900b4795e55e9a70c2696" },
  "tid_pos.dat.gz": { bytes: 5_916_009, md5: "6b89472ae7b079cc8cb6d5758356ff37" },
  "tid_map.dat.gz": { bytes: 1_485_576, md5: "ab259890529abb432a5c20aff4efb021" },
  "cc.dat.gz": { bytes: 1_692_067, md5: "05321caff24f87d1bed64fe1d44576fc" },
  "unk.dat.gz": { bytes: 10_512, md5: "9229f1b8c742cd15ff3229ed3700112a" },
  "unk_pos.dat.gz": { bytes: 10_540, md5: "5986e78e268fa51e3e119511ec914dd9" },
  "unk_map.dat.gz": { bytes: 1_190, md5: "eda6e0354662ee169e817f5848ab56d4" },
  "unk_char.dat.gz": { bytes: 306, md5: "557c5cc25a480e1946150625face4c91" },
  "unk_compat.dat.gz": { bytes: 338, md5: "da69ebce7400cc6ba01f5ce19d3108f1" },
  "unk_invoke.dat.gz": { bytes: 1_140, md5: "6b5a7c42a945cbba596148fecc2d56b4" },
} as const;

export type DictionaryFileName = keyof typeof DICTIONARY_FILES;

export const DICTIONARY_FILE_NAMES = Object.keys(DICTIONARY_FILES) as DictionaryFileName[];

/** Total download size (bytes). */
export const DICTIONARY_BYTES = DICTIONARY_FILE_NAMES.reduce(
  (sum, name) => sum + DICTIONARY_FILES[name].bytes,
  0,
);
