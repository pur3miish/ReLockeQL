import { GraphQLScalarType } from "graphql";

/** JSON values returned by blockchain and Hyperion APIs. */
export const json_type = new GraphQLScalarType({
  name: "relocke_json",
  description:
    "A decoded JSON value returned by a configured provider. The value may be an object, array, string, number, boolean, or null.",
  serialize(value: unknown): unknown {
    return value;
  },
  parseValue(value: unknown): unknown {
    return value;
  }
});
