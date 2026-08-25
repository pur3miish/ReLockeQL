import type { AbiDef } from "./serialize_abi.js";

type AbiStruct = NonNullable<AbiDef["structs"]>[number];

const BUILT_IN_TYPES = new Set([
  "bool",

  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "int128",
  "uint128",

  "varint32",
  "varuint32",

  "float32",
  "float64",
  "float128",

  "time_point",
  "time_point_sec",
  "block_timestamp_type",

  "name",

  "bytes",
  "string",

  "checksum160",
  "checksum256",
  "checksum512",

  "public_key",
  "signature",

  "symbol",
  "symbol_code",
  "asset",
  "extended_asset"
]);

function assert_unique<T>(
  values: readonly T[],
  get_key: (value: T) => string,
  definition: string
): Map<string, T> {
  const result = new Map<string, T>();

  for (const value of values) {
    const key = get_key(value);

    if (result.has(key)) {
      throw new Error(`Duplicate ABI ${definition} definition: "${key}".`);
    }

    result.set(key, value);
  }

  return result;
}

/**
 * Returns the underlying type for one ABI type modifier.
 *
 * This intentionally mirrors the reference implementation's fundamental_type():
 *
 * uint64[]  -> uint64
 * uint64[4] -> uint64
 * uint64?   -> uint64
 *
 * Only one modifier is removed at a time, matching the reference implementation.
 */
function fundamental_type(type: string): string {
  if (type.endsWith("[]")) {
    return type.slice(0, -2);
  }

  const open_bracket = type.lastIndexOf("[");
  const close_bracket = type.lastIndexOf("]");

  if (open_bracket !== -1 && close_bracket === type.length - 1) {
    const size = type.slice(open_bracket + 1, close_bracket);

    if (size.length > 0 && /^\d+$/.test(size)) {
      return type.slice(0, open_bracket);
    }
  }

  if (type.endsWith("?")) {
    return type.slice(0, -1);
  }

  return type;
}

/**
 * Binary extensions are valid on struct fields.
 *
 * Example:
 *
 * string$
 */
function remove_binary_extension(type: string): string {
  if (type.endsWith("$")) {
    return type.slice(0, -1);
  }

  return type;
}

function resolve_typedef(
  type: string,
  typedefs: ReadonlyMap<string, string>
): string {
  let current = type;

  /*
   * Typedef cycles are checked separately.
   * The bound is retained as defensive protection.
   */
  for (let i = 0; i <= typedefs.size; i += 1) {
    const next = typedefs.get(current);

    if (next === undefined) {
      return current;
    }

    current = next;
  }

  throw new Error(`Circular ABI typedef detected while resolving "${type}".`);
}

function is_abi_type(
  type: string,
  typedefs: ReadonlyMap<string, string>,
  structs: ReadonlyMap<string, AbiStruct>,
  variants: ReadonlySet<string>,
  resolving = new Set<string>()
): boolean {
  const fundamental = fundamental_type(type);

  if (BUILT_IN_TYPES.has(fundamental)) {
    return true;
  }

  if (structs.has(fundamental)) {
    return true;
  }

  if (variants.has(fundamental)) {
    return true;
  }

  const aliased_type = typedefs.get(fundamental);

  if (aliased_type === undefined) {
    return false;
  }

  if (resolving.has(fundamental)) {
    return false;
  }

  const next_resolving = new Set(resolving);

  next_resolving.add(fundamental);

  return is_abi_type(aliased_type, typedefs, structs, variants, next_resolving);
}

function assert_typedefs_are_valid(
  typedefs: ReadonlyMap<string, string>,
  structs: ReadonlyMap<string, AbiStruct>,
  variants: ReadonlySet<string>
): void {
  /*
   * Detect direct typedef cycles first.
   *
   * Examples:
   *
   * a -> a
   *
   * a -> b
   * b -> a
   *
   * a -> b
   * b -> c
   * c -> a
   */
  for (const [name, target] of typedefs) {
    const seen = new Set<string>([name]);

    let current: string | undefined = target;

    while (current !== undefined && typedefs.has(current)) {
      if (seen.has(current)) {
        throw new Error(`Circular ABI typedef detected for "${name}".`);
      }

      seen.add(current);

      current = typedefs.get(current);
    }
  }

  /*
   * Every typedef must eventually resolve to
   * an actual ABI type.
   */
  for (const [name, target] of typedefs) {
    if (!is_abi_type(target, typedefs, structs, variants)) {
      throw new Error(
        `ABI typedef "${name}" references unknown type "${target}".`
      );
    }
  }
}

function assert_structs_are_valid(
  structs: ReadonlyMap<string, AbiStruct>,
  typedefs: ReadonlyMap<string, string>,
  variants: ReadonlySet<string>
): void {
  for (const struct of structs.values()) {
    /*
     * Validate struct inheritance and detect:
     *
     * a -> b -> a
     */
    if (struct.base) {
      const seen = new Set<string>([struct.name]);

      let current = struct;

      while (current.base) {
        const resolved_base = resolve_typedef(current.base, typedefs);

        const base_struct = structs.get(resolved_base);

        if (!base_struct) {
          throw new Error(
            `ABI struct "${current.name}" references unknown base struct "${current.base}".`
          );
        }

        if (seen.has(base_struct.name)) {
          throw new Error(
            `Circular ABI struct inheritance detected for "${struct.name}".`
          );
        }

        seen.add(base_struct.name);

        current = base_struct;
      }
    }

    /*
     * Every struct field must resolve to:
     *
     * - built-in type
     * - typedef
     * - struct
     * - variant
     */
    for (const field of struct.fields ?? []) {
      const type = remove_binary_extension(field.type);

      if (!is_abi_type(type, typedefs, structs, variants)) {
        throw new Error(
          `ABI field "${struct.name}.${field.name}" references unknown type "${field.type}".`
        );
      }
    }
  }
}

/**
 * Validates the semantic type graph of an EOSIO-compatible ABI.
 *
 * This corresponds to the validation performed by
 * the reference implementation's abi_serializer::set_abi() and
 * abi_serializer::validate().
 *
 * It intentionally does not serialize or mutate the ABI.
 */
export function validate_abi(abi: AbiDef): void {
  const struct_list = abi.structs ?? [];

  const type_list = abi.types ?? [];

  const action_list = abi.actions ?? [];

  const table_list = abi.tables ?? [];

  const error_message_list = abi.error_messages ?? [];

  const variant_list = abi.variants ?? [];

  const action_result_list = abi.action_results ?? [];

  /*
   * The reference implementation loads structs before typedefs.
   */
  const structs = assert_unique(struct_list, ({ name }) => name, "struct");

  /*
   * Typedef names may not shadow:
   *
   * - built-in types
   * - structs
   * - previous typedefs
   *
   * This mirrors Spring's _is_type() check while
   * loading typedef definitions.
   */
  const typedefs = new Map<string, string>();

  for (const definition of type_list) {
    const { new_type_name, type } = definition;

    if (
      BUILT_IN_TYPES.has(new_type_name) ||
      structs.has(new_type_name) ||
      typedefs.has(new_type_name)
    ) {
      throw new Error(`Duplicate ABI type definition: "${new_type_name}".`);
    }

    typedefs.set(new_type_name, type);
  }

  /*
   * These collections are keyed exactly as
   * Spring stores them internally.
   */
  assert_unique(action_list, ({ name }) => name, "action");

  assert_unique(table_list, ({ name }) => name, "table");

  assert_unique(
    error_message_list,
    ({ error_code }) => String(error_code),
    "error message"
  );

  const variants = assert_unique(variant_list, ({ name }) => name, "variant");

  assert_unique(action_result_list, ({ name }) => name, "action result");

  const variant_names = new Set(variants.keys());

  assert_typedefs_are_valid(typedefs, structs, variant_names);

  assert_structs_are_valid(structs, typedefs, variant_names);

  /*
   * Every variant member must be a
   * valid ABI type.
   */
  for (const variant of variant_list) {
    for (const type of variant.types) {
      if (!is_abi_type(type, typedefs, structs, variant_names)) {
        throw new Error(
          `ABI variant "${variant.name}" references unknown type "${type}".`
        );
      }
    }
  }

  /*
   * Actions must reference valid ABI types.
   */
  for (const action of action_list) {
    if (!is_abi_type(action.type, typedefs, structs, variant_names)) {
      throw new Error(
        `ABI action "${action.name}" references unknown type "${action.type}".`
      );
    }
  }

  /*
   * Tables must reference valid ABI types.
   */
  for (const table of table_list) {
    if (!is_abi_type(table.type, typedefs, structs, variant_names)) {
      throw new Error(
        `ABI table "${table.name}" references unknown type "${table.type}".`
      );
    }
  }

  /*
   * Action results must reference valid ABI types.
   */
  for (const result of action_result_list) {
    if (!is_abi_type(result.result_type, typedefs, structs, variant_names)) {
      throw new Error(
        `ABI action result "${result.name}" references unknown type "${result.result_type}".`
      );
    }
  }
}
