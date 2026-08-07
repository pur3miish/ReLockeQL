import { GraphQLError } from "graphql";

import { type NetworkContext } from "./types/Context.js";

export interface SendTransactionArgs {
  transaction_header: string;
  transaction_body: string;
  signatures: string[];
}

interface PushedTransactionResponse {
  // You can expand this interface with more specific fields if you know them
  error?: any;
  message?: string;
  [key: string]: any;
}

/**
 * Send a serialized transaction to the blockchain.
 * @param args Object containing transaction_header, transaction_body, signatures
 * @param network Network context with fetch and rpc_url
 */
export async function send_transaction_rpc(
  args: SendTransactionArgs,
  network: NetworkContext
): Promise<PushedTransactionResponse> {
  const { transaction_header, transaction_body, signatures } = args;
  const { rpc_url, fetchOptions } = network;

  const pushed_txn_req = await fetch(`${rpc_url}/v1/chain/send_transaction`, {
    method: "POST",
    ...fetchOptions,
    body: JSON.stringify({
      signatures,
      compression: 0,
      packed_context_free_data: "",
      packed_trx: transaction_header + transaction_body
    })
  });

  const pushed_transaction: PushedTransactionResponse =
    await pushed_txn_req.json();

  if (pushed_transaction.error)
    throw new GraphQLError(pushed_transaction.message ?? "Unknown error", {
      extensions: pushed_transaction.error
    });

  return pushed_transaction;
}
