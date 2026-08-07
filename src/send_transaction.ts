import type { GraphQLResolveInfo } from "graphql";
import { GraphQLNonNull } from "graphql";

import { configuration_type } from "./graphql_input_types/configuration.js";
import { transaction_receipt_type as transaction_receipt } from "./graphql_object_types/transaction_receipt.js";
import { mutation_resolver } from "./mutation_resolver.js";
import { send_transaction_rpc } from "./send_transaction_rpc.js";
import type { Context } from "./types/Context.js";
import { sha256 } from "./utils/sha256.js";

type GraphQLFieldConfig<
  TSource,
  TContext,
  TArgs = { [argName: string]: any }
> = {
  description?: string;
  type: any;
  args?: { [key in keyof TArgs]: { type: any } };
  resolve?: (
    source: TSource,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo
  ) => any;
};

export interface SerializedTransaction {
  chain_id: string;
  transaction_header: string;
  transaction_body: string;
  transaction: Record<string, any>;
}

interface SendTransactionArgs {
  actions: any;
  configuration?: any;
}

function hex_to_bytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      "Transaction signing data must be a valid even-length hexadecimal string."
    );
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

export const send_transaction = (
  actionsType: any,
  ast_list: any
): GraphQLFieldConfig<any, any, SendTransactionArgs> => ({
  description:
    "Serialize a list of actions and push them to the blockchain in one step, requires private keys to be supplied to RelockeQL.",

  type: new GraphQLNonNull(transaction_receipt),

  args: {
    actions: {
      type: actionsType
    },

    configuration: {
      type: configuration_type
    }
  },

  async resolve(
    root: any,
    args: SendTransactionArgs,
    context: Context,
    info: GraphQLResolveInfo
  ) {
    const network = context.network(root, args, info);

    const { chain_id, transaction_header, transaction_body, transaction } =
      await mutation_resolver(args, network, ast_list);

    const context_free_data_hash = "0".repeat(64);

    const transaction_bytes =
      chain_id + transaction_header + transaction_body + context_free_data_hash;

    const hash_to_sign = await sha256(hex_to_bytes(transaction_bytes));

    const signatures = await context.signTransaction?.(
      hash_to_sign,
      {
        chain_id,
        transaction_header,
        transaction_body
      },
      transaction
    );

    if (!signatures?.length) {
      throw new Error("No signatures available.");
    }

    return send_transaction_rpc(
      {
        transaction_body,
        transaction_header,
        signatures
      },
      network
    );
  }
});
