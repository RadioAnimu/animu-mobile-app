// kuromoji 0.1.2 and zlibjs ship no types; only the pieces the app loads.

declare module "zlibjs/bin/gunzip.min.js" {
  export const Zlib: {
    Gunzip: new (input: Uint8Array) => { decompress(): Uint8Array };
  };
}

declare module "kuromoji/src/dict/DynamicDictionaries" {
  export default class DynamicDictionaries {
    loadTrie(base: Int32Array, check: Int32Array): this;
    loadTokenInfoDictionaries(tokenInfo: Uint8Array, pos: Uint8Array, targetMap: Uint8Array): this;
    loadConnectionCosts(costs: Int16Array): this;
    loadUnknownDictionaries(
      unk: Uint8Array,
      unkPos: Uint8Array,
      unkMap: Uint8Array,
      categoryMap: Uint8Array,
      compatibleCategoryMap: Uint32Array,
      invokeDefinition: Uint8Array,
    ): this;
  }
}

declare module "kuromoji/src/Tokenizer" {
  export default class Tokenizer {
    constructor(dictionaries: object);
    tokenize(text: string): Record<string, string | number | undefined>[];
  }
}
