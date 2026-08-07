import { GraphQLError, GraphQLScalarType } from "graphql";

export const varint32_type = new GraphQLScalarType({
  name: "varint32",
  description: `
\`varint32\`

A Signed LEB128 variable-length integer, limited to 32 bits (i.e., the values [-2^(32-1), +2^(32-1)-1]), represented by at most ceil(32/7) bytes that may contain padding 0x80 or 0xFF bytes.
  `,
  parseValue(value: unknown): unknown {
    // Here you can add specific validation if you want,
    // for example check if value is number or string representing a number,
    // and if it fits into the varint32 range.

    // For now, just pass through
    return value;
  }
});
