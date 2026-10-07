// kuromoji 0.1.2 ships no types; only the pieces the app loads.

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
  /** An IPADIC token: surface form, part of speech, reading… */
  export type IpadicToken = Record<string, string | number | undefined>;

  export default class Tokenizer {
    constructor(dictionaries: object);
    tokenize(text: string): IpadicToken[];
  }
}
