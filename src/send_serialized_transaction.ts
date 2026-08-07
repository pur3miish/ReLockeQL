import {
  GraphQLFieldConfig,
  GraphQLList,
  GraphQLNonNull,
  GraphQLResolveInfo
} from "graphql";

import { transaction_receipt_type as transaction_receipt } from "./graphql_object_types/transaction_receipt.js";
import { bytes_type } from "./relocke_types/bytes_type.js";
import { signature_type } from "./relocke_types/signature_type.js";
import { send_transaction_rpc } from "./send_transaction_rpc.js";
import { type Context } from "./types/Context.js";

interface SendSerializedTransactionArgs {
  transaction_header: any; // type for bytes_type — adjust if you have a specific type
  transaction_body: any; // same here
  signatures: any[]; // array of signature_type instances (adjust if you have a better type)
}

/**
 * Push transaction type.
 */
export const send_serialized_transaction: GraphQLFieldConfig<
  any, // source/root type (usually unused here)
  any, // context type
  SendSerializedTransactionArgs
> = {
  description: "Sends a serialized transaction to the blockchain.",
  type: new GraphQLNonNull(transaction_receipt),
  args: {
    transaction_header: { type: new GraphQLNonNull(bytes_type) },
    transaction_body: { type: new GraphQLNonNull(bytes_type) },
    signatures: { type: new GraphQLNonNull(new GraphQLList(signature_type)) }
  },
  resolve(
    root: any,
    args: SendSerializedTransactionArgs,
    context: Context,
    info: GraphQLResolveInfo
  ) {
    return send_transaction_rpc(args, context.network(root, args, info));
  }
};
