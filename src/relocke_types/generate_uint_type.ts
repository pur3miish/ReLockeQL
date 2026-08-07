import { GraphQLError, GraphQLScalarType } from "graphql";

/**
 * Generates a GraphQL scalar unsigned integer type of size `bits`.
 * @param bits Size of the unsigned int in bits.
 * @returns GraphQLScalarType representing the unsigned integer type.
 */
export function generate_uint_type(bits: number): GraphQLScalarType {
  const size = 2n ** BigInt(bits);

  return new GraphQLScalarType({
    name: `uint${bits}`,
    description: `\`Unsigned integer${bits} type\`

Unsigned integer range is between 0 - ${size.toString()}`,
    parseValue(value: unknown): string {
      if (value === "") return "";

      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "bigint"
      ) {
        throw new GraphQLError("Value must be a string, number, or bigint");
      }

      let uintVal: bigint;
      try {
        uintVal = BigInt(value);
      } catch {
        throw new GraphQLError("Value cannot be converted to BigInt");
      }

      if (uintVal >= size || uintVal < 0n) {
        throw new GraphQLError(`Integer range is outside uint${bits}.`);
      }

      return uintVal.toString();
    }
  });
}
