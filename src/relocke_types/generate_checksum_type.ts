import { GraphQLError, GraphQLScalarType } from "graphql";

/**
 * Generates a GraphQL scalar type for checksum of `size`.
 * @param size Size of the checksum in bytes.
 * @returns GraphQLScalarType representing the checksum.
 */
export function generate_checksum(size: number): GraphQLScalarType {
  return new GraphQLScalarType({
    name: `checksum${size * 8}`,
    description: `\`Checksum${size * 8} type\`

Represented as a hexadecimal string of ${size * 2} characters.
`,
    parseValue(value: unknown): string {
      if (typeof value !== "string") {
        throw new GraphQLError("Checksum value must be a string");
      }
      // Optionally validate length and hex format here
      // e.g. length check:
      if (value.length !== size * 2) {
        throw new GraphQLError(
          `Checksum must be exactly ${size * 2} hex characters long`
        );
      }
      if (!/^[A-Fa-f0-9]+$/g.test(value)) {
        throw new GraphQLError("Checksum must be a hexadecimal string");
      }
      return value;
    }
  });
}
