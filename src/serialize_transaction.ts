import { GraphQLList, GraphQLNonNull } from "graphql";

import { configuration_type } from "./graphql_input_types/configuration.js";
import { packed_transaction_type } from "./graphql_object_types/packed_transaction.js";
import { mutation_resolver } from "./mutation_resolver.js";
import { public_key_type } from "./relocke_types/public_key_type.js";
import { type Context } from "./types/Context.js";

interface SerializeTransactionArgs {
  actions: any; // Replace `any` with the actual GraphQL type of `actions` if available
  configuration?: any; // Replace `any` with the type of configuration_type if known
  available_keys?: string[]; // assuming public keys as strings, change if different
}

export const serialize_transaction = (
  actions: any, // type of actions GraphQL input
  ast_list: any // AST type, adjust as needed
): {
  description: string;
  type: GraphQLNonNull<typeof packed_transaction_type>;
  args: {
    actions: { type: any };
    configuration: { type: any };
    available_keys: { type: GraphQLList<typeof public_key_type> };
  };
  resolve: (
    root: any,
    args: SerializeTransactionArgs,
    context: Context,
    info: any
  ) => Promise<any>;
} => ({
  description: "Serialize a list of actions into an atomic binary instruction.",
  type: new GraphQLNonNull(packed_transaction_type),
  args: {
    actions: {
      type: actions
    },
    configuration: {
      type: configuration_type
    },
    available_keys: {
      type: new GraphQLList(public_key_type)
    }
  },
  async resolve(root, { available_keys, ...args }, context, info) {
    const { rpc_url, fetchOptions } = context.network(
      root,
      { available_keys, ...args },
      info
    );

    const { transaction, ...serialized_txn } = await mutation_resolver(
      args,
      { rpc_url, fetchOptions },
      ast_list
    );

    return { ...serialized_txn, available_keys, transaction };
  }
});
