import { GraphQLError, GraphQLScalarType } from "graphql";

/**
 * Generates a GraphQL scalar Float type of `size`.
 * @param size Size of the float; typically 32, 64 or 128.
 * @returns GraphQLScalarType representing the float type.
 */
export function generate_float_type(size: number): GraphQLScalarType {
  return new GraphQLScalarType({
    name: `float${size}`,
    description: `\`Float${size} type\``,

    parseValue(value: unknown): number {
      if (typeof value !== "number" && typeof value !== "string") {
        throw new GraphQLError(`Float${size} value must be a number or string`);
      }
      // Just return it as-is, cast to any to avoid TS error
      return value as any;
    }
  });
}
