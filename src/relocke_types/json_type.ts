import { GraphQLScalarType } from "graphql";

/** JSON values returned by blockchain and Hyperion APIs. */
export const json_type = new GraphQLScalarType({
  name: "relocke_json",
  description: "A decoded JSON value returned by a configured provider.",
  serialize(value: unknown): unknown {
    return value;
  },
  parseValue(value: unknown): unknown {
    return value;
  }
});
