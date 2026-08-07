import { GraphQLError, GraphQLScalarType } from "graphql";

export const time_point_sec_type = new GraphQLScalarType({
  name: "time_point_sec",
  description: `
\`time point sec\`

Number of seconds since epoch (Unix time).
  `,
  parseValue(value: unknown): number | string {
    // You can customize this to enforce number or string if you want

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      // Optionally, validate string represents a number
      if (!/^\d+$/.test(value)) {
        throw new GraphQLError("time_point_sec string value must be numeric.");
      }
      return value;
    }

    throw new GraphQLError(
      "time_point_sec value must be a number or numeric string."
    );
  }
});
