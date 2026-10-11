// kuromoji 0.1.2 ships no types; only the pieces the app loads.

declare module "kuromoji/src/dict/DynamicDictionaries" {
  /** A dictionary of words: entries, their features, the id → entries map. */
  export interface WordDictionary {
    loadDictionary(buffer: Uint8Array): this;
    loadPosVector(buffer: Uint8Array): this;
    loadTargetMap(buffer: Uint8Array): this;
    target_map: Record<number, number[]>;
  }

  export interface UnknownWordDictionary extends WordDictionary {
    character_definition: object;
  }

  export default class DynamicDictionaries {
    // kuromoji's own (snake_case) property names.
    // eslint-disable-next-line sonarjs/variable-name
    token_info_dictionary: WordDictionary;
    // eslint-disable-next-line sonarjs/variable-name
    unknown_dictionary: UnknownWordDictionary;
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

declare module "kuromoji/src/dict/CharacterDefinition" {
  const CharacterDefinition: {
    load(categoryMap: Uint8Array, compatibleCategoryMap: Uint32Array, invokeDefinition: Uint8Array): object;
  };
  export default CharacterDefinition;
}

declare module "kuromoji/src/Tokenizer" {
  /** An IPADIC token: surface form, part of speech, reading… */
  export type IpadicToken = Record<string, string | number | undefined>;

  export default class Tokenizer {
    constructor(dictionaries: object);
    tokenize(text: string): IpadicToken[];
  }
}
