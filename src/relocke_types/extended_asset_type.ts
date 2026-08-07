import { GraphQLError, GraphQLScalarType } from "graphql";

export const extended_asset_type = new GraphQLScalarType({
  name: "extended_asset",
  description: `
\`Extended_asset\`

Extended asset which stores the information of the owner of the asset.

### extended asset
- Start with asset type followed by “@” and the account name.

example:

1.0000 EOS@eosio.token
  `,
  parseValue(value: unknown): string {
    if (typeof value !== "string") {
      throw new GraphQLError("Extended asset must be a string");
    }

    return value;
  }
});
