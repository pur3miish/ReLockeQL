import { GraphQLError, GraphQLScalarType } from "graphql";

export const signature_type = new GraphQLScalarType({
  name: "signature",
  description: `
\`Signature type\`

Relocke based signature, K1, R1 WA.
  `,
  parseValue(value: unknown): string {
    if (value === "") return "";
    if (typeof value !== "string") {
      throw new GraphQLError("Expected signature to be a string");
    }
    return value;
  }
});
