import { base58_to_binary, binary_to_base58 } from "base58-js";
import { GraphQLError, GraphQLScalarType } from "graphql";
import { ripemd160 } from "ripemd160-js";

function checksum_matches(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) {
      return false;
    }
  }

  return true;
}

function legacy_to_k1(key: string): string {
  const key_without_prefix = key.replace(/^[A-Z]+/u, "");

  const decoded = base58_to_binary(key_without_prefix);

  if (decoded.length !== 37) {
    throw new GraphQLError("Invalid legacy public key length.");
  }

  const public_key = decoded.slice(0, -4);

  const legacy_checksum = decoded.slice(-4);

  const expected_legacy_checksum = ripemd160(public_key).slice(0, 4);

  if (!checksum_matches(legacy_checksum, expected_legacy_checksum)) {
    throw new GraphQLError("Invalid legacy public key checksum.");
  }

  const checksum = ripemd160(Uint8Array.from([...public_key, 75, 49])).slice(
    0,
    4
  );

  return (
    "PUB_K1_" + binary_to_base58(Uint8Array.from([...public_key, ...checksum]))
  );
}

export const public_key_type = new GraphQLScalarType({
  name: "public_key",

  parseValue(value: unknown): string {
    if (value === "") return "";

    if (typeof value !== "string") {
      throw new GraphQLError("Public key must be a string");
    }

    if (
      !value.startsWith("PUB_K1_") &&
      !value.startsWith("PUB_R1_") &&
      !value.startsWith("PUB_WA_") &&
      !value.startsWith("EOS")
    ) {
      throw new GraphQLError(
        "Public keys must be either K1, R1, WA or legacy keys."
      );
    }

    return value;
  },

  serialize(key: unknown): string {
    if (typeof key !== "string") {
      throw new GraphQLError("Public key must be a string");
    }

    if (key.startsWith("EOS")) {
      return legacy_to_k1(key);
    }

    return key;
  }
});
