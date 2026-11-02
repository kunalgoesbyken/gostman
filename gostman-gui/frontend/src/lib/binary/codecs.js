import { decodeCbor, encodeCbor } from './cbor'
import { decodeMessagePack, encodeMessagePack } from './messagePack'
import { decodedJson } from './values'

const CODECS = {
  msgpack: { decode: decodeMessagePack, encode: encodeMessagePack },
  cbor: { decode: decodeCbor, encode: encodeCbor },
}

export const decodeToJson = (name, bytes) => decodedJson(CODECS[name].decode(bytes))

export const encodeJson = (name, text) => CODECS[name].encode(JSON.parse(text))
