import { GraphQLError, GraphQLScalarType } from "graphql";

export const name_type = new GraphQLScalarType({
  name: "name",
  description: `
\`Name type\`

Names are unique identifiers on the blockchain.

---

### name rules

- Combination of lowercase characters
- Can include numbers 1 - 5 and period “.” character
- Must NOT end with a period “.”
- Must NOT be longer than 12 characters
`,
  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Name must be a string.");
    }
    if (value === "") return value;

    if (!/^[1-5a-z.]{0,11}[1-5a-z]{1}$/gmu.test(value)) {
      throw new GraphQLError(`Invalid name “${value}”.`);
    }

    return value;
  }
});
