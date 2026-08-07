import serialize from "eosio-wasm-js/serialize.js";

import { validate_abi } from "./validate_abi.js";

interface AbiField {
  name: string;
  type: string;
}

interface AbiStruct {
  name: string;
  base: string;
  fields: AbiField[];
}

interface AbiTypeDef {
  new_type_name: string;
  type: string;
}

interface AbiActionDef {
  name: string;
  type: string;
  ricardian_contract: string;
}

interface AbiTableDef {
  name: string;
  index_type: string;
  key_names: string[];
  key_types: string[];
  type: string;
}

interface AbiClausePair {
  id: string;
  body: string;
}

interface AbiErrorMessage {
  error_code: string | number | bigint;
  error_msg: string;
}

interface AbiVariantDef {
  name: string;
  types: string[];
}

interface AbiActionResultDef {
  name: string;
  result_type: string;
}

interface AbiExtensionsEntry {
  tag: number;
  value: string;
}

type AbiExtensionsInput = AbiExtensionsEntry | [number, string];

export interface AbiDef {
  version: string;

  types?: AbiTypeDef[];
  structs?: AbiStruct[];
  actions?: AbiActionDef[];
  tables?: AbiTableDef[];

  ricardian_clauses?: AbiClausePair[];
  error_messages?: AbiErrorMessage[];

  abi_extensions?: AbiExtensionsInput[];

  /**
   * Trailing Antelope ABI binary extension.
   *
   * When omitted, no bytes are written for this field.
   */
  variants?: AbiVariantDef[];

  /**
   * Trailing Antelope ABI binary extension.
   *
   * `variants` must exist before this field can be encoded.
   */
  action_results?: AbiActionResultDef[];

  /**
   * Not part of the current Antelope Spring abi_def layout.
   *
   * Retained here only so callers receive an explicit error rather
   * than having the value silently ignored.
   */
  kv_tables?: unknown;
}

interface EosioWasmSerialize {
  name(value: string): string;

  uint16(value: string | number | bigint): string;

  uint64(value: string | number | bigint): string;

  varuint32(value: number): string;
}

const wasm = serialize as unknown as EosioWasmSerialize;

const text_encoder = new TextEncoder();

function bytes_to_hex(bytes: Uint8Array): string {
  let hex = "";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex;
}

/**
 * Serializes a JavaScript string using Antelope's
 * string representation:
 *
 * varuint32 UTF-8 byte length + UTF-8 bytes.
 *
 * Do not use eosio-wasm-js/string.js here because ABI
 * strings must count UTF-8 bytes, not JavaScript characters.
 */
function serialize_string(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("Expected ABI string value.");
  }

  const bytes = text_encoder.encode(value);

  return wasm.varuint32(bytes.length) + bytes_to_hex(bytes);
}

function serialize_vector<T>(
  values: readonly T[],
  serializer: (value: T) => string
): string {
  if (!Array.isArray(values)) {
    throw new TypeError("Expected ABI vector to be an array.");
  }

  let output = wasm.varuint32(values.length);

  for (const value of values) {
    output += serializer(value);
  }

  return output;
}

/**
 * Serializes vector<char>/bytes:
 *
 * varuint32 byte length + raw bytes.
 */
function serialize_bytes(value: string): string {
  if (
    typeof value !== "string" ||
    value.length % 2 !== 0 ||
    !/^[0-9a-fA-F]*$/.test(value)
  ) {
    throw new TypeError(
      "ABI extension value must be an even-length hexadecimal string."
    );
  }

  return wasm.varuint32(value.length / 2) + value.toLowerCase();
}

function serialize_type_def(value: AbiTypeDef): string {
  return serialize_string(value.new_type_name) + serialize_string(value.type);
}

function serialize_field_def(value: AbiField): string {
  return serialize_string(value.name) + serialize_string(value.type);
}

function serialize_struct_def(value: AbiStruct): string {
  return (
    serialize_string(value.name) +
    serialize_string(value.base ?? "") +
    serialize_vector(value.fields ?? [], serialize_field_def)
  );
}

function serialize_action_def(value: AbiActionDef): string {
  return (
    wasm.name(value.name) +
    serialize_string(value.type) +
    serialize_string(value.ricardian_contract ?? "")
  );
}

function serialize_table_def(value: AbiTableDef): string {
  return (
    wasm.name(value.name) +
    serialize_string(value.index_type) +
    serialize_vector(value.key_names ?? [], serialize_string) +
    serialize_vector(value.key_types ?? [], serialize_string) +
    serialize_string(value.type)
  );
}

function serialize_clause_pair(value: AbiClausePair): string {
  return serialize_string(value.id) + serialize_string(value.body);
}

function serialize_error_message(value: AbiErrorMessage): string {
  return wasm.uint64(value.error_code) + serialize_string(value.error_msg);
}

function serialize_abi_extension(value: AbiExtensionsInput): string {
  const tag = Array.isArray(value) ? value[0] : value.tag;

  const data = Array.isArray(value) ? value[1] : value.value;

  return wasm.uint16(tag) + serialize_bytes(data);
}

function serialize_variant_def(value: AbiVariantDef): string {
  return (
    serialize_string(value.name) +
    serialize_vector(value.types, serialize_string)
  );
}

function serialize_action_result_def(value: AbiActionResultDef): string {
  return wasm.name(value.name) + serialize_string(value.result_type);
}

function assert_supported_version(version: unknown): asserts version is string {
  if (typeof version !== "string" || !/^eosio::abi\/1\.\d+$/.test(version)) {
    throw new Error(`Unsupported ABI version: ${String(version)}`);
  }
}

function assert_binary_extension_order(abi: AbiDef): void {
  if (abi.action_results !== undefined && abi.variants === undefined) {
    throw new Error(
      "Cannot serialize abi_def.action_results when abi_def.variants is omitted."
    );
  }

  if (abi.kv_tables !== undefined) {
    throw new Error(
      "abi_def.kv_tables is not part of the current Antelope Spring abi_def binary layout."
    );
  }
}

/**
 * Serializes an Antelope abi_def into the hexadecimal
 * bytes accepted by eosio::setabi.
 *
 * Binary layout:
 *
 * version
 * types
 * structs
 * actions
 * tables
 * ricardian_clauses
 * error_messages
 * abi_extensions
 * [variants]
 * [action_results]
 *
 * `variants` and `action_results` are trailing fields.
 * If an earlier trailing field is omitted, a later one
 * cannot be encoded.
 */
export function serialize_abi(abi: AbiDef): string {
  assert_supported_version(abi.version);

  assert_binary_extension_order(abi);

  validate_abi(abi);

  let output = serialize_string(abi.version);

  output += serialize_vector(abi.types ?? [], serialize_type_def);

  output += serialize_vector(abi.structs ?? [], serialize_struct_def);

  output += serialize_vector(abi.actions ?? [], serialize_action_def);

  output += serialize_vector(abi.tables ?? [], serialize_table_def);

  output += serialize_vector(
    abi.ricardian_clauses ?? [],
    serialize_clause_pair
  );

  output += serialize_vector(abi.error_messages ?? [], serialize_error_message);

  output += serialize_vector(abi.abi_extensions ?? [], serialize_abi_extension);

  /*
   * These are `may_not_exist` trailing fields in
   * Antelope's abi_def.
   *
   * Undefined means no bytes are written.
   *
   * [] means the field exists and its zero-length
   * vector byte (00) is written.
   */

  if (abi.variants !== undefined) {
    output += serialize_vector(abi.variants, serialize_variant_def);
  }

  if (abi.action_results !== undefined) {
    output += serialize_vector(abi.action_results, serialize_action_result_def);
  }

  return output.toLowerCase();
}
