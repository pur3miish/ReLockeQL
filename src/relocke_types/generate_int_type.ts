import { GraphQLError, GraphQLScalarType } from "graphql";

/**
 * Generates a GraphQL scalar signed integer type of size `bits`.
 * @param bits Size of the integer in bits.
 * @returns GraphQLScalarType representing the signed integer type.
 */
export function generate_int_type(bits: number): GraphQLScalarType {
  const bitsBigInt = BigInt(bits);
  const max = 2n ** (bitsBigInt - 1n) - 1n;
  const min = -(2n ** (bitsBigInt - 1n));

  return new GraphQLScalarType({
    name: `int${bits}`,
    description: `\`Integer t${bits} type\`

Signed integer range is between ${min} - ${max}`,
    parseValue(value: unknown): string {
      if (value == "") return "";
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "bigint"
      ) {
        throw new GraphQLError("Value must be a string, number, or bigint");
      }

      // Convert value to BigInt safely
      let intVal: bigint;
      try {
        intVal = BigInt(value);
      } catch {
        throw new GraphQLError("Value cannot be converted to BigInt");
      }

      if (intVal > max || intVal < min) {
        throw new GraphQLError(`Integer range is outside int${bits}.`);
      }

      return intVal.toString();
    }
  });
}
