import { GraphQLError, GraphQLScalarType } from "graphql";

export const varuint32_type = new GraphQLScalarType({
  name: "varuint32",
  description: `
\`varuint32\`

A LEB128 variable-length integer, limited to 32 bits (i.e., the values [0, 2^32-1]), represented by at most ceil(32/7) bytes that may contain padding 0x80 bytes.
  `,
  parseValue(value: unknown): number | string {
    if (value == "") return "";
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new GraphQLError("varuint32 must be an unsigned 32-bit integer.");
      }
      return value;
    }

    if (typeof value === "string") {
      const num = Number(value);
      if (
        !/^\d+$/.test(value) ||
        Number.isNaN(num) ||
        num < 0 ||
        num > 0xffffffff
      ) {
        throw new GraphQLError(
          "varuint32 string must represent an unsigned 32-bit integer."
        );
      }
      return value;
    }

    throw new TypeError("varuint32 must be a number or numeric string.");
  }
});
