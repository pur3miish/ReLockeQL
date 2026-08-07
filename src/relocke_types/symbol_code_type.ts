import { GraphQLError, GraphQLScalarType } from "graphql";

export const symbol_code_type = new GraphQLScalarType({
  name: "symbol_code",
  description: "`Symbol code type`",
  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Symbol code must be a string.");
    }
    if (!/^[A-Z]{1,7}$/gm.test(value)) {
      throw new Error("Invalid symbol code.");
    }
    return value;
  }
});
