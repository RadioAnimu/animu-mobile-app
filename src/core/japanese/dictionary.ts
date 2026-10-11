// ─── IPADIC for kuromoji 0.1.2 ───
//
// The 12 gzipped files the npm package ships under `dict/` (17.8 MB). They
// are downloaded on demand, never bundled; each one is checked against the
// size and MD5 of the published package, then unpacked once (100 MB, mostly
// zero padding) and stored without the trailing padding (64.5 MB). A session
// reads the stored files natively and pads them back in memory — gunzip in
// JS takes seconds, so it runs once per install, not per session.

/** Bumped whenever the stored layout changes: an older install re-installs. */
export const DICTIONARY_VERSION = "kuromoji-0.1.2-ipadic-unpacked-1";

/** Mirrors of the npm package, tried in order for every file. */
export const DICTIONARY_MIRRORS = [
  "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/",
  "https://unpkg.com/kuromoji@0.1.2/dict/",
] as const;

interface DictionaryFile {
  /** The published `.gz`: size and MD5. */
  bytes: number;
  md5: string;
  /** Unpacked size, padding included (what kuromoji is handed). */
  unpacked: number;
  /** Unpacked size without the trailing zero padding (what is stored). */
  stored: number;
}

export const DICTIONARY_FILES = {
  "base.dat.gz": { bytes: 3_956_825, md5: "7c8bbced46e88cdb77c9c66c9ca9fbcb", unpacked: 8_388_608, stored: 8_388_608 },
  "check.dat.gz": { bytes: 3_111_633, md5: "dcbeea0429520f5e669a75ff504241a7", unpacked: 8_388_608, stored: 8_388_608 },
  "tid.dat.gz": { bytes: 1_605_820, md5: "48d8e87b50f900b4795e55e9a70c2696", unpacked: 10_485_760, stored: 3_921_260 },
  "tid_pos.dat.gz": { bytes: 5_916_009, md5: "6b89472ae7b079cc8cb6d5758356ff37", unpacked: 41_943_040, stored: 36_028_024 },
  "tid_map.dat.gz": { bytes: 1_485_576, md5: "ab259890529abb432a5c20aff4efb021", unpacked: 4_194_304, stored: 4_175_475 },
  "cc.dat.gz": { bytes: 1_692_067, md5: "05321caff24f87d1bed64fe1d44576fc", unpacked: 3_463_716, stored: 3_463_716 },
  "unk.dat.gz": { bytes: 10_512, md5: "9229f1b8c742cd15ff3229ed3700112a", unpacked: 10_485_760, stored: 398 },
  "unk_pos.dat.gz": { bytes: 10_540, md5: "5986e78e268fa51e3e119511ec914dd9", unpacked: 10_485_760, stored: 1_595 },
  "unk_map.dat.gz": { bytes: 1_190, md5: "eda6e0354662ee169e817f5848ab56d4", unpacked: 1_048_576, stored: 250 },
  "unk_char.dat.gz": { bytes: 306, md5: "557c5cc25a480e1946150625face4c91", unpacked: 65_536, stored: 65_536 },
  "unk_compat.dat.gz": { bytes: 338, md5: "da69ebce7400cc6ba01f5ce19d3108f1", unpacked: 262_144, stored: 121_337 },
  "unk_invoke.dat.gz": { bytes: 1_140, md5: "6b5a7c42a945cbba596148fecc2d56b4", unpacked: 1_048_576, stored: 152 },
} as const satisfies Record<string, DictionaryFile>;

export type DictionaryFileName = keyof typeof DICTIONARY_FILES;

export const DICTIONARY_FILE_NAMES = Object.keys(DICTIONARY_FILES) as DictionaryFileName[];

const sum = (pick: (file: DictionaryFile) => number) =>
  DICTIONARY_FILE_NAMES.reduce((total, name) => total + pick(DICTIONARY_FILES[name]), 0);

/** Download size (bytes). */
export const DICTIONARY_BYTES = sum((file) => file.bytes);

/** Size on disk once installed (bytes). */
export const DICTIONARY_STORED_BYTES = sum((file) => file.stored);
