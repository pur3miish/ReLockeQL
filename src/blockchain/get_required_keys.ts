import {
  GraphQLError,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLString
} from "graphql";

import { authorization_type } from "../graphql_input_types/authorization.js";
import { bytes_type } from "../relocke_types/bytes_type.js";
import { name_type } from "../relocke_types/name_type.js";
import { public_key_type } from "../relocke_types/public_key_type.js";

interface ActionInput {
  account?: string;
  name?: string;
  authorization?: Array<any>;
  data?: string;
  hex_data?: string;
}

interface TransactionInput {
  expiration?: string;
  ref_block_num?: string;
  ref_block_prefix?: string;
  max_net_usage_words?: string;
  max_cpu_usage_ms?: string;
  actions?: ActionInput[];
  context_free_actions?: string;
}

interface GetRequiredKeysArgs {
  transaction?: TransactionInput;
  available_keys?: string[];
}

interface GetRequiredKeysResponse {
  required_keys: string[];
  error?: any;
  message?: string;
}

const action_type = new GraphQLInputObjectType({
  name: "required_keys_action",
  fields: {
    account: {
      type: name_type,
      description: "The smart contract name"
    },
    name: { type: name_type },
    authorization: { type: new GraphQLList(authorization_type) },
    data: { type: GraphQLString },
    hex_data: { type: bytes_type }
  }
});

const transaction_type = new GraphQLInputObjectType({
  name: "required_keys_transaction",
  fields: {
    expiration: { type: GraphQLString },
    ref_block_num: { type: GraphQLString },
    ref_block_prefix: { type: GraphQLString },
    max_net_usage_words: { type: GraphQLString },
    max_cpu_usage_ms: { type: GraphQLString },
    actions: { type: new GraphQLList(action_type) },
    context_free_actions: { type: GraphQLString }
  }
});

export interface Context {
  network(
    root: any,
    args: any,
    info: any
  ): {
    rpc_url: string | URL | Request;
    fetchOptions: RequestInit;
  };
  signTransaction?: (transaction: any) => Promise<any>;
}

export const get_required_keys: GraphQLFieldConfig<
  unknown,
  any,
  GetRequiredKeysArgs
> = {
  description: "Retrieve the required keys for a transaction.",
  type: new GraphQLList(public_key_type),
  args: {
    transaction: {
      type: transaction_type
    },
    available_keys: {
      type: new GraphQLList(public_key_type)
    }
  },
  async resolve(
    root,
    { available_keys = [], transaction },
    context: Context,
    info
  ) {
    const { rpc_url, fetchOptions } = context.network(
      root,
      { available_keys, transaction },
      info
    );

    const uri = `${rpc_url}/v1/chain/get_required_keys`;

    if (!transaction) {
      throw new GraphQLError("Transaction argument is required.");
    }

    const { actions = [], ...txn } = transaction;

    const data = await fetch(uri, {
      method: "POST",
      ...fetchOptions,
      body: JSON.stringify({
        available_keys: await Promise.all(available_keys),
        transaction: {
          ...txn,
          actions: actions.map(({ data, ...object }) => ({
            ...object,
            ...(data ? { data: JSON.parse(data) } : {})
          }))
        }
      })
    });

    const response: GetRequiredKeysResponse = await data.json();

    if (response.error) {
      throw new GraphQLError(response.message || "Unknown error", {
        extensions: response.error
      });
    }

    return response.required_keys;
  }
};
