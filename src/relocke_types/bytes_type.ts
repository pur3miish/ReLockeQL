import { GraphQLError, GraphQLScalarType } from "graphql";

export const bytes_type = new GraphQLScalarType({
  name: "bytes",
  description: "Hexadecimal text string type.",
  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Value must be a string");
    }
    if (value === "") return value;
    if (!/^[A-Fa-f0-9]+$/gmu.test(value)) {
      throw new GraphQLError("Invalid hexadecimal string: " + value);
    }
    if (value.length % 2 !== 0) {
      throw new GraphQLError("Invalid hexadecimal string length");
    }
    return value;
  }
});
