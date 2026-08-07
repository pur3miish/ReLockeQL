import { GraphQLError, GraphQLScalarType } from "graphql";

export const time_point_type = new GraphQLScalarType({
  name: "time_point",
  description: `
\`time point\`

Number of milliseconds since epoch (Unix time).
  `,
  parseValue(value: unknown): number | string {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      // Optionally validate string is numeric
      if (!/^\d+$/.test(value)) {
        throw new GraphQLError("time_point string value must be numeric.");
      }
      return value;
    }

    throw new GraphQLError(
      "time_point value must be a number or numeric string."
    );
  }
});
