import {
  execute,
  GraphQLObjectType,
  GraphQLSchema,
  parse,
  Source,
  validate
} from "graphql";

import { build_graphql_fields_from_abis as build_graphql_fields_from_abis } from "../src/build_graphql_fields_from_abis.js";
import { actions_type as actions } from "../src/graphql_input_types/actions.js";
import { serialize_transaction } from "../src/serialize_transaction.js";
/* Importing the ABIs into a list */
import eosio_abi from "./abis/eosio.json" with { type: "json" };
import token_abi from "./abis/eosio.token.json" with { type: "json" };
import nutrientjrn_abi from "./abis/nutrientjrn.abi.json" with { type: "json" };
import variantTypeExample from "./abis/variantTypeExample.abi.json" with { type: "json" };

const ABI_LIST = [
  { account_name: "eosio", abi: eosio_abi },
  { account_name: "eosio.token", abi: token_abi },
  { account_name: "nutrijournal", abi: nutrientjrn_abi },
  {
    account_name: "relockeblock",
    abi: variantTypeExample
  }
];

/* Build a GraphQL schema fields */
const { mutation_fields, query_fields, ast_list } =
  build_graphql_fields_from_abis(ABI_LIST);

// Consume the query fields like any
const queries = new GraphQLObjectType({
  name: "Query",
  description: "Query table data from Relocke blockchain.",
  fields: query_fields
});

const action_fields = actions(mutation_fields);

const mutations = new GraphQLObjectType({
  name: "Mutation",
  description: "Push transactions to the blockchain.",
  fields: {
    serialize_transaction: serialize_transaction(action_fields, ast_list)
  }
});

const schema = new GraphQLSchema({ query: queries, mutation: mutations });

const RelockeQL = (query: string) => {
  const document = parse(new Source(query));
  const queryErrors = validate(schema, document);
  if (queryErrors.length) throw queryErrors;

  return execute({
    schema,
    document,
    contextValue: {
      network: () => ({
        rpc_url: "https://jungle.relocke.io"
      })
    },
    fieldResolver(rootValue, args, ctx, { fieldName }) {
      return rootValue[fieldName];
    }
  });
};

export default RelockeQL;
