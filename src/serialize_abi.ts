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

type NormalizedAbi = Omit<AbiDef, "abi_extensions"> & {
  abi_extensions: AbiExtensionsEntry[];
};

class AbiBinaryWriter {
  private readonly bytes: number[] = [];
  private readonly textEncoder = new TextEncoder();

  uint16(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff)
      throw new Error(`uint16 is out of range: ${String(value)}`);
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
  }

  uint64(value: string | number): void {
    let number: bigint;
    try {
      number = BigInt(value);
    } catch {
      throw new Error(`Invalid uint64: ${String(value)}`);
    }
    if (number < 0n || number > 0xffff_ffff_ffff_ffffn)
      throw new Error(`uint64 is out of range: ${String(value)}`);
    for (let byte = 0; byte < 8; byte++) {
      this.bytes.push(Number(number & 0xffn));
      number >>= 8n;
    }
  }

  varuint32(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff)
      throw new Error(`varuint32 is out of range: ${String(value)}`);
    do {
      const next = value & 0x7f;
      value >>>= 7;
      this.bytes.push(value ? next | 0x80 : next);
    } while (value);
  }

  string(value: string): void {
    if (typeof value !== "string")
      throw new Error(`Expected string, received ${typeof value}`);
    this.byteArray(this.textEncoder.encode(value));
  }

  hexBytes(value: string): void {
    if (typeof value !== "string" || !/^(?:[0-9a-fA-F]{2})*$/.test(value))
      throw new Error("Expected an even-length hexadecimal string");
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < bytes.length; index++)
      bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    this.byteArray(bytes);
  }

  name(value: string): void {
    if (typeof value !== "string" || !/^[.1-5a-z]{0,12}[.1-5a-j]?$/.test(value))
      throw new Error(`Invalid Antelope name: ${String(value)}`);

    let encoded = 0n;
    for (let index = 0; index < 13; index++) {
      const symbol =
        index < value.length ? nameSymbol(value.charCodeAt(index)) : 0;
      if (index < 12)
        encoded |= BigInt(symbol & 0x1f) << BigInt(64 - 5 * (index + 1));
      else encoded |= BigInt(symbol & 0x0f);
    }
    this.uint64(encoded.toString());
  }

  vector<T>(values: T[], write: (value: T) => void): void {
    if (!Array.isArray(values)) throw new Error("Expected an array");
    this.varuint32(values.length);
    for (const value of values) write(value);
  }

  toHex(): string {
    return this.bytes
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private byteArray(value: Uint8Array): void {
    this.varuint32(value.length);
    this.bytes.push(...value);
  }
}

function nameSymbol(character: number): number {
  if (character >= 97 && character <= 122) return character - 97 + 6;
  if (character >= 49 && character <= 53) return character - 49 + 1;
  return 0;
}

function normalizeAbi(abi: Partial<AbiDef>): NormalizedAbi {
  const normalized = {
    ...abi,
    abi_extensions: (abi.abi_extensions ?? []).map((extension) =>
      Array.isArray(extension)
        ? { tag: extension[0], value: extension[1] }
        : extension
    )
  } as NormalizedAbi;

  for (const field of REQUIRED_ABI_ARRAY_FIELDS) normalized[field] ??= [];
  return normalized;
}

/**
 * Serializes an Antelope `abi_def` using its canonical field order and binary
 * encodings. Trailing ABI 1.1/1.2 fields retain binary-extension semantics.
 *
 * @param abi - Relocke ABI object to serialize
 * @returns lowercase hexadecimal bytes accepted by `eosio::setabi`
 */
export function serialize_abi(abi: Partial<AbiDef>): string {
  const value = normalizeAbi(abi);
  if (
    typeof value.version !== "string" ||
    !value.version.startsWith("eosio::abi/1.")
  )
    throw new Error(`Unsupported ABI version: ${String(value.version)}`);

  const writer = new AbiBinaryWriter();
  writer.string(value.version);
  writer.vector(value.types, (item) => {
    writer.string(item.new_type_name);
    writer.string(item.type);
  });
  writer.vector(value.structs, (item) => {
    writer.string(item.name);
    writer.string(item.base);
    writer.vector(item.fields, (field) => {
      writer.string(field.name);
      writer.string(field.type);
    });
  });
  writer.vector(value.actions, (item) => {
    writer.name(item.name);
    writer.string(item.type);
    writer.string(item.ricardian_contract);
  });
  writer.vector(value.tables, (item) => {
    writer.name(item.name);
    writer.string(item.index_type);
    writer.vector(item.key_names, (key) => writer.string(key));
    writer.vector(item.key_types, (key) => writer.string(key));
    writer.string(item.type);
  });
  writer.vector(value.ricardian_clauses, (item) => {
    writer.string(item.id);
    writer.string(item.body);
  });
  writer.vector(value.error_messages, (item) => {
    writer.uint64(item.error_code);
    writer.string(item.error_msg);
  });
  writer.vector(value.abi_extensions, (item) => {
    writer.uint16(item.tag);
    writer.hexBytes(item.value);
  });

  writeBinaryExtensions(writer, value);
  return writer.toHex();
}

function writeBinaryExtensions(
  writer: AbiBinaryWriter,
  abi: NormalizedAbi
): void {
  let omitted = false;
  const field = <T>(name: string, write: (value: T) => void): void => {
    if (
      Object.prototype.hasOwnProperty.call(abi, name) &&
      abi[name as keyof NormalizedAbi] !== undefined
    ) {
      if (omitted) throw new Error(`unexpected abi_def.${name}`);
      write(abi[name as keyof NormalizedAbi] as T);
    } else omitted = true;
  };

  field<AbiVariantDef[]>("variants", (variants) =>
    writer.vector(variants, (item) => {
      writer.string(item.name);
      writer.vector(item.types, (type) => writer.string(type));
    })
  );
  field<AbiActionResultDef[]>("action_results", (results) =>
    writer.vector(results, (item) => {
      writer.name(item.name);
      writer.string(item.result_type);
    })
  );
  field<Record<string, AbiKvTableEntryDef>>("kv_tables", (tables) => {
    const entries = Object.entries(tables);
    writer.varuint32(entries.length);
    for (const [name, table] of entries) {
      writer.name(name);
      writer.string(table.type);
      writer.name(table.primary_index.name);
      writer.string(table.primary_index.type);
      const indexes = Object.entries(table.secondary_indices);
      writer.varuint32(indexes.length);
      for (const [indexName, index] of indexes) {
        writer.name(indexName);
        writer.string(index.type);
      }
    }
  });
}
