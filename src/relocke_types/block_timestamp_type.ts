import { GraphQLError, GraphQLScalarType } from "graphql";

export const block_timestamp_type = new GraphQLScalarType({
  name: "block_timestamp_type",
  description: "`Block timestamp type`",
  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Block timestamp must be a string");
    }
    if (value === "") return "";
    if (Number.isNaN(Date.parse(value))) {
      throw new GraphQLError("Invalid block timestamp " + value);
    }
    return value;
  }
});
