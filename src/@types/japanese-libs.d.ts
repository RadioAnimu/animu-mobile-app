declare module "zlibjs/bin/gunzip.min.js" {
  export const Zlib: {
    Gunzip: new (input: Uint8Array) => { decompress(): Uint8Array };
  };
}

declare module "kuromoji/src/dict/DynamicDictionaries" {
  export default class DynamicDictionaries {
    loadTrie(baseBuffer: Int32Array, checkBuffer: Int32Array): void;
    loadTokenInfoDictionaries(
      tokenInfoBuffer: Uint8Array,
      posBuffer: Uint8Array,
      targetMapBuffer: Uint8Array,
    ): void;
    loadConnectionCosts(ccBuffer: Int16Array): void;
    loadUnknownDictionaries(
      unkBuffer: Uint8Array,
      unkPosBuffer: Uint8Array,
      unkMapBuffer: Uint8Array,
      catMapBuffer: Uint8Array,
      compatCatMapBuffer: Uint32Array,
      invokeDefBuffer: Uint8Array,
    ): void;
  }
}

declare module "kuromoji/src/Tokenizer" {
  export default class Tokenizer {
    constructor(dictionary: object);
    tokenize(text: string): {
      surface_form?: string;
      reading?: string;
      [key: string]: unknown;
    }[];
  }
}
