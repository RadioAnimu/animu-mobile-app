import DynamicDictionaries from "kuromoji/src/dict/DynamicDictionaries";
import Tokenizer from "kuromoji/src/Tokenizer";
import { Zlib } from "zlibjs/bin/gunzip.min.js";
import type { MinimalTokenizer } from "./dictionary-manager";

// ─── kuromoji tokenizer factory (React Native binding) ───
//
// Reimplements kuromoji's DictionaryLoader orchestration (its own base
// class needs node "path"/"async", which don't exist in RN) around the
// pure-JS pieces that Metro CAN bundle: DynamicDictionaries, Tokenizer
// and zlibjs gunzip. All 12 IPADIC files load in parallel — they've
// already been downloaded to local storage by the dictionary manager.

const asDataView = (bytes: Uint8Array): ArrayBuffer => bytes.buffer as ArrayBuffer;

function gunzip(bytes: Uint8Array): Uint8Array {
  return new Zlib.Gunzip(bytes).decompress();
}

export async function buildKuromojiTokenizer(
  load: (fileName: string) => Promise<Uint8Array>,
): Promise<MinimalTokenizer> {
  const dic = new DynamicDictionaries();

  const [base, check] = await Promise.all([
    load("base.dat.gz"),
    load("check.dat.gz"),
  ]);
  dic.loadTrie(
    new Int32Array(asDataView(gunzip(base))),
    new Int32Array(asDataView(gunzip(check))),
  );

  const [tokenInfo, posTags, targetMap] = await Promise.all([
    load("tid.dat.gz"),
    load("tid_pos.dat.gz"),
    load("tid_map.dat.gz"),
  ]);
  dic.loadTokenInfoDictionaries(
    new Uint8Array(asDataView(gunzip(tokenInfo))),
    new Uint8Array(asDataView(gunzip(posTags))),
    new Uint8Array(asDataView(gunzip(targetMap))),
  );

  const costs = gunzip(await load("cc.dat.gz"));
  dic.loadConnectionCosts(new Int16Array(asDataView(costs)));

  const [unk, unkPos, unkMap, unkChar, unkCompat, unkInvoke] = await Promise.all(
    [
      load("unk.dat.gz"),
      load("unk_pos.dat.gz"),
      load("unk_map.dat.gz"),
      load("unk_char.dat.gz"),
      load("unk_compat.dat.gz"),
      load("unk_invoke.dat.gz"),
    ],
  );
  dic.loadUnknownDictionaries(
    new Uint8Array(asDataView(gunzip(unk))),
    new Uint8Array(asDataView(gunzip(unkPos))),
    new Uint8Array(asDataView(gunzip(unkMap))),
    new Uint8Array(asDataView(gunzip(unkChar))),
    new Uint32Array(asDataView(gunzip(unkCompat))),
    new Uint8Array(asDataView(gunzip(unkInvoke))),
  );

  return new Tokenizer(dic) as MinimalTokenizer;
}
