import { Serialize } from "eosjs";

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
  error_code: string | number;
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

interface AbiPrimaryKeyIndexDef {
  name: string;
  type: string;
}

interface AbiSecondaryIndexDef {
  type: string;
}

interface AbiKvTableEntryDef {
  type: string;
  primary_index: AbiPrimaryKeyIndexDef;
  secondary_indices: Record<string, AbiSecondaryIndexDef>;
}

interface AbiDef {
  version: string;
  types: AbiTypeDef[];
  structs: AbiStruct[];
  actions: AbiActionDef[];
  tables: AbiTableDef[];
  ricardian_clauses: AbiClausePair[];
  error_messages: AbiErrorMessage[];
  abi_extensions: AbiExtensionsInput[];
  variants?: AbiVariantDef[];
  action_results?: AbiActionResultDef[];
  kv_tables?: Record<string, AbiKvTableEntryDef>;
}

const REQUIRED_ABI_ARRAY_FIELDS = [
  "types",
  "structs",
  "actions",
  "tables",
  "ricardian_clauses",
  "error_messages",
  "abi_extensions"
] as const;

function normalizeAbi(abi: Partial<AbiDef>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    ...abi,
    abi_extensions: (abi.abi_extensions ?? []).map((extension) =>
      Array.isArray(extension)
        ? { tag: extension[0], value: extension[1] }
        : extension
    )
  };

  for (const field of REQUIRED_ABI_ARRAY_FIELDS) {
    normalized[field] ??= [];
  }

  return normalized;
}

function createAbiType(): Serialize.Type {
  const abiType = Serialize.getTypesFromAbi(Serialize.createAbiTypes()).get(
    "abi_def"
  );

  if (!abiType)
    throw new Error("EOSJS did not provide its abi_def serializer.");
  return abiType;
}

/**
 * Serializes Antelope abi_def with EOSJS's SerialBuffer and ABI type graph.
 * This preserves UTF-8 string bytes and enforces the ordered trailing binary
 * extensions used by ABI 1.1 and 1.2.
 *
 * @param abi - Relocke ABI object to serialize
 * @returns hex string of serialized ABI
 */
export async function serialize_abi(abi: Partial<AbiDef>): Promise<string> {
  const normalizedAbi = normalizeAbi(abi);
  const version = normalizedAbi.version;
  if (typeof version !== "string" || !Serialize.supportedAbiVersion(version)) {
    throw new Error(`Unsupported ABI version: ${String(version)}`);
  }

  const abiType = createAbiType();
  const buffer = new Serialize.SerialBuffer({
    textEncoder: new TextEncoder(),
    textDecoder: new TextDecoder()
  });
  abiType.serialize(buffer, normalizedAbi);
  const rawAbi = buffer.asUint8Array();

  // Do not return bytes unless EOSJS can decode the complete abi_def and the
  // Ricardian clauses survive the round trip exactly.
  const verificationBuffer = new Serialize.SerialBuffer({
    textEncoder: new TextEncoder(),
    textDecoder: new TextDecoder(),
    array: rawAbi
  });
  const decoded = abiType.deserialize(verificationBuffer) as Partial<AbiDef>;
  if (verificationBuffer.haveReadData()) {
    throw new Error("EOSJS did not consume the complete serialized ABI.");
  }
  if (
    JSON.stringify(decoded.ricardian_clauses ?? []) !==
    JSON.stringify(normalizedAbi.ricardian_clauses ?? [])
  ) {
    throw new Error("EOSJS did not round-trip the Ricardian clauses exactly.");
  }

  return Serialize.arrayToHex(rawAbi).toLowerCase();
}
