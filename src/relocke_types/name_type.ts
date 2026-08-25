import { GraphQLError, GraphQLScalarType } from "graphql";

/**
 * EOSIO-compatible account/name scalar.
 *
 * Protocol names contain at most 13 characters.
 *
 * Characters 1-12:
 *   . 1-5 a-z
 *
 * Character 13:
 *   1-5 a-j
 *
 * A trailing "." is not valid because Spring requires
 * the supplied name to equal its normalized representation.
 */
export const name_type = new GraphQLScalarType({
  name: "name",

  description: `
\`Name type\`

Names are identifiers encoded into the protocol's 64-bit \`name\` representation.

### Name rules

- Maximum length is 13 characters.
- Characters 1-12 may contain:
  - lowercase \`a-z\`
  - digits \`1-5\`
  - period \`.\`
- The 13th character, when present, is restricted to:
  - lowercase \`a-j\`
  - digits \`1-5\`
- Names must not end with \`.\`.
`,

  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Name must be a string.");
    }

    if (value === "") {
      return "";
    }

    const valid = /^(?:[.1-5a-z]{0,11}[1-5a-z]|[.1-5a-z]{12}[1-5a-j])$/.test(
      value
    );

    if (!valid) {
      throw new GraphQLError(`Invalid name “${value}”.`);
    }

    return value;
  }
});
