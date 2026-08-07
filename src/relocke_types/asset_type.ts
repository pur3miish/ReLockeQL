import { GraphQLError, GraphQLScalarType } from "graphql";

export const asset_type = new GraphQLScalarType({
  description: `
\`Asset type\`

---

An \`asset\` type describes a blockchain asset and includes a quantity and a symbol section.


- The quantity must include decimal precision (with a maximum precision of 18)
- Symbol must be an uppercase string of 7 or less characters from [A-Z]

***example*** - \`1.0010 EOS\`

- Quantity is 1.0010
- Symbol is EOS

`,
  name: "asset",
  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Asset value must be a string.");
    }

    if (value == "") return "";

    if (!value.match(/^\d+(\.\d+)?\s[A-Z]{1,7}$/gmu))
      throw new GraphQLError("Invalid asset type supplied.");

    if (value.replace(/[A-Z.\s]/gmu, "").length > 21)
      throw new GraphQLError("Invalid asset size, maximum (2 ^ 62) - 1");

    return value;
  }
});
